const {Router}=require('express');
const controller=require('../controllers/auditoria.controller');
const {authGuard,roleGuard}=require('../middlewares/auth.middleware');
const {validateSchema}=require('../middlewares/validation.middleware');
const {listAuditSchema}=require('../validators/auditoria.validator');
const router=Router();
// Auditoria is exclusively for SUPER_ADMIN - they see all companies' activity
router.use(authGuard,roleGuard(['SUPER_ADMIN']));
router.get('/export',validateSchema(listAuditSchema),controller.exportar);
router.get('/',validateSchema(listAuditSchema),controller.list);
module.exports=router;
