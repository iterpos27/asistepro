function formatIssue(issue) {
  return {
    campo: issue.path.join('.'),
    mensaje: issue.message,
  };
}

function validateSchema(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        ok: false,
        message: 'Error de validacion de datos',
        errors: result.error.issues.map(formatIssue),
      });
    }

    req.validated = result.data;
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;
    return next();
  };
}

module.exports = {
  validateSchema,
};
