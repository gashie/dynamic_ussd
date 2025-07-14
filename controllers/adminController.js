const { 
  getAllActiveApps, 
  createApp, 
  updateApp, 
  deleteApp 
} = require('../models/appModel');
const { 
  getMenusByAppId, 
  createMenu, 
  updateMenu, 
  deleteMenu,
  getMenuFlow 
} = require('../models/menuModel');
const { 
  getApiConfigsByAppId, 
  createApiConfig, 
  updateApiConfig, 
  deleteApiConfig 
} = require('../models/apiModel');

// Apps management
const listApps = async (req, res) => {
  try {
    const apps = await getAllActiveApps();
    res.json({ success: true, data: apps });
  } catch (error) {
    console.error('List Apps Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createNewApp = async (req, res) => {
  try {
    const { ussdCode, appName, entryMenu, config } = req.body;
    
    // Validate input
    if (!ussdCode || !appName || !entryMenu) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ussdCode, appName, entryMenu'
      });
    }
    
    const app = await createApp({ ussdCode, appName, entryMenu, config });
    res.status(201).json({ success: true, data: app });
  } catch (error) {
    console.error('Create App Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateExistingApp = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const app = await updateApp(id, updates);
    if (!app) {
      return res.status(404).json({ success: false, error: 'App not found' });
    }
    
    res.json({ success: true, data: app });
  } catch (error) {
    console.error('Update App Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteExistingApp = async (req, res) => {
  try {
    const { id } = req.params;
    
    const app = await deleteApp(id);
    if (!app) {
      return res.status(404).json({ success: false, error: 'App not found' });
    }
    
    res.json({ success: true, message: 'App deactivated successfully' });
  } catch (error) {
    console.error('Delete App Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Menus management
const listMenus = async (req, res) => {
  try {
    const { appId } = req.params;
    const menus = await getMenusByAppId(appId);
    res.json({ success: true, data: menus });
  } catch (error) {
    console.error('List Menus Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createNewMenu = async (req, res) => {
  try {
    const { appId } = req.params;
    const menuData = { ...req.body, appId: parseInt(appId) };
    
    // Validate required fields
    if (!menuData.menuCode || !menuData.textTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: menuCode, textTemplate'
      });
    }
    
    const menu = await createMenu(menuData);
    res.status(201).json({ success: true, data: menu });
  } catch (error) {
    console.error('Create Menu Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateExistingMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const menu = await updateMenu(id, updates);
    if (!menu) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }
    
    res.json({ success: true, data: menu });
  } catch (error) {
    console.error('Update Menu Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteExistingMenu = async (req, res) => {
  try {
    const { id } = req.params;
    
    const menu = await deleteMenu(id);
    if (!menu) {
      return res.status(404).json({ success: false, error: 'Menu not found' });
    }
    
    res.json({ success: true, message: 'Menu deleted successfully' });
  } catch (error) {
    console.error('Delete Menu Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAppMenuFlow = async (req, res) => {
  try {
    const { appId } = req.params;
    const flow = await getMenuFlow(appId);
    res.json({ success: true, data: flow });
  } catch (error) {
    console.error('Get Menu Flow Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// API configs management
const listApiConfigs = async (req, res) => {
  try {
    const { appId } = req.params;
    const configs = await getApiConfigsByAppId(appId);
    res.json({ success: true, data: configs });
  } catch (error) {
    console.error('List API Configs Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createNewApiConfig = async (req, res) => {
  try {
    const { appId } = req.params;
    const configData = { ...req.body, appId: parseInt(appId) };
    
    // Validate required fields
    if (!configData.apiName || !configData.endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: apiName, endpoint'
      });
    }
    
    const config = await createApiConfig(configData);
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    console.error('Create API Config Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateExistingApiConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const config = await updateApiConfig(id, updates);
    if (!config) {
      return res.status(404).json({ success: false, error: 'API config not found' });
    }
    
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Update API Config Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteExistingApiConfig = async (req, res) => {
  try {
    const { id } = req.params;
    
    const config = await deleteApiConfig(id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'API config not found' });
    }
    
    res.json({ success: true, message: 'API config deleted successfully' });
  } catch (error) {
    console.error('Delete API Config Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Bulk operations
const importConfiguration = async (req, res) => {
  try {
    const { app, menus, apiConfigs } = req.body;
    
    // Create app
    const newApp = await createApp(app);
    
    // Create menus
    const menuPromises = menus.map(menu => 
      createMenu({ ...menu, appId: newApp.id })
    );
    await Promise.all(menuPromises);
    
    // Create API configs
    const apiPromises = apiConfigs.map(config => 
      createApiConfig({ ...config, appId: newApp.id })
    );
    await Promise.all(apiPromises);
    
    res.json({ 
      success: true, 
      message: 'Configuration imported successfully',
      appId: newApp.id 
    });
  } catch (error) {
    console.error('Import Configuration Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const exportConfiguration = async (req, res) => {
  try {
    const { appId } = req.params;
    
    // Get app
    const apps = await getAllActiveApps();
    const app = apps.find(a => a.id === parseInt(appId));
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'App not found' });
    }
    
    // Get menus and API configs
    const menus = await getMenusByAppId(appId);
    const apiConfigs = await getApiConfigsByAppId(appId);
    
    const configuration = {
      app: {
        ussdCode: app.ussd_code,
        appName: app.app_name,
        entryMenu: app.entry_menu,
        config: app.config
      },
      menus: menus.map(m => ({
        menuCode: m.menu_code,
        menuType: m.menu_type,
        textTemplate: m.text_template,
        options: m.options,
        validationRules: m.validation_rules,
        apiCalls: m.api_calls,
        nextMenu: m.next_menu
      })),
      apiConfigs: apiConfigs.map(c => ({
        apiName: c.api_name,
        endpoint: c.endpoint,
        method: c.method,
        headers: c.headers,
        bodyTemplate: c.body_template,
        authConfig: c.auth_config,
        responseMapping: c.response_mapping,
        timeout: c.timeout,
        retryCount: c.retry_count
      }))
    };
    
    res.json({ success: true, data: configuration });
  } catch (error) {
    console.error('Export Configuration Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
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
};