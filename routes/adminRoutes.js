const express = require('express');
const router = express.Router();
const {
  // Apps
  listApps,
  createNewApp,
  updateExistingApp,
  deleteExistingApp,
  
  // Menus
  listMenus,
  createNewMenu,
  updateExistingMenu,
  deleteExistingMenu,
  getAppMenuFlow,
  
  // API Configs
  listApiConfigs,
  createNewApiConfig,
  updateExistingApiConfig,
  deleteExistingApiConfig,
  
  // Bulk operations
  importConfiguration,
  exportConfiguration
} = require('../controllers/adminController');

// Apps management
router.get('/apps', listApps);
router.post('/apps', createNewApp);
router.put('/apps/:id', updateExistingApp);
router.delete('/apps/:id', deleteExistingApp);

// Menus management
router.get('/apps/:appId/menus', listMenus);
router.post('/apps/:appId/menus', createNewMenu);
router.put('/menus/:id', updateExistingMenu);
router.delete('/menus/:id', deleteExistingMenu);
router.get('/apps/:appId/flow', getAppMenuFlow);

// API configurations
router.get('/apps/:appId/api-configs', listApiConfigs);
router.post('/apps/:appId/api-configs', createNewApiConfig);
router.put('/api-configs/:id', updateExistingApiConfig);
router.delete('/api-configs/:id', deleteExistingApiConfig);

// Import/Export
router.post('/import', importConfiguration);
router.get('/apps/:appId/export', exportConfiguration);

module.exports = router;