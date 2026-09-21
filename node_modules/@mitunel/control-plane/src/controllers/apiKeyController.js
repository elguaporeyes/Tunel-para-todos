const ApiKey = require('../models/ApiKey');

exports.listApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ user: req.user._id, isActive: true })
      .sort({ createdAt: -1 })
      .select('key name lastUsedAt createdAt');

    res.json({ success: true, keys });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createApiKey = async (req, res) => {
  try {
    const { name } = req.body;
    const newKey = ApiKey.generateNewToken();

    const apiKey = await ApiKey.create({
      key: newKey,
      user: req.user._id,
      name: name || 'CLI Token ' + new Date().toLocaleDateString(),
    });

    res.status(201).json({
      success: true,
      message: 'Nuevo API Token generado con éxito',
      apiKey: {
        id: apiKey._id,
        key: apiKey.key,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.revokeApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;

    const apiKey = await ApiKey.findOne({ _id: keyId, user: req.user._id });
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API Key no encontrada' });
    }

    apiKey.isActive = false;
    await apiKey.save();

    res.json({ success: true, message: 'API Key revocada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
