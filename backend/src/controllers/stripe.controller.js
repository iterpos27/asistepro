const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const facturacionService = require('../services/facturacion.service');

function canAccessEmpresa(req, empresaId) {
  if (req.user.rol === 'SUPER_ADMIN') return true;
  return req.user.empresa_id === empresaId;
}

async function createCheckoutSession(req, res, next) {
  try {
    const { factura_id } = req.body;
    
    if (!factura_id) {
      return res.status(400).json({ ok: false, message: 'factura_id es requerido' });
    }

    const factura = await facturacionService.findFacturaById(factura_id);
    if (!factura) {
      return res.status(404).json({ ok: false, message: 'Factura no encontrada' });
    }

    if (!canAccessEmpresa(req, factura.empresa_id)) {
      return res.status(403).json({ ok: false, message: 'No tiene permisos para pagar esta factura' });
    }

    if (factura.estado === 'pagada') {
      return res.status(400).json({ ok: false, message: 'La factura ya se encuentra pagada' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: factura.concepto,
              description: `Factura N° ${factura.numero}`,
            },
            unit_amount: Math.round(Number(factura.total) * 100), // Stripe expects unit amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/checkout?factura_id=${factura.id}&status=success`,
      cancel_url: `${frontendUrl}/checkout?factura_id=${factura.id}&status=cancel`,
      metadata: {
        factura_id: factura.id,
        empresa_id: factura.empresa_id,
      },
    });

    return res.status(201).json({ ok: true, data: { url: session.url } });
  } catch (error) {
    return next(error);
  }
}

async function handleWebhook(req, res, next) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    return res.status(400).send('Falta firma de Stripe o secreto del webhook.');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Fallo en la validacion de firma del webhook de Stripe:', err.message);
    return res.status(400).send(`Webhook Signature Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { factura_id, empresa_id } = session.metadata;
    const monto = session.amount_total / 100;

    try {
      await facturacionService.checkoutSimulado({
        factura_id,
        empresa_id,
        banco: 'Stripe (Internacional)',
        monto,
      });
      console.log(`Webhook Stripe: Factura ${factura_id} pagada e inicio de suscripción completado.`);
    } catch (dbError) {
      console.error('Error al procesar actualizacion de BD mediante Webhook:', dbError.message);
      return res.status(500).send(`Database Error: ${dbError.message}`);
    }
  }

  return res.json({ received: true });
}

module.exports = {
  createCheckoutSession,
  handleWebhook,
};
