const Service = require('../models/Service');
const mongoose = require('mongoose');

// @route   POST /api/services
// @access  Private (service_provider only)
const createService = async (req, res, next) => {
  try {
    const { name, price, category, description, specs, images, durationEstimate, availability } = req.body;

    const service = await Service.create({
      provider: req.user._id,
      name,
      price,
      category,
      description,
      specs,
      images,
      durationEstimate,
      availability
    });

    res.status(201).json({ service });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/services/:id
// @access  Private (service_provider only, must own the service)
const updateService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    if (service.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to edit this service' });
    }

    const allowedFields = ['name', 'price', 'category', 'description', 'specs', 'images', 'durationEstimate', 'availability', 'isActive'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        service[field] = req.body[field];
      }
    });

    await service.save();
    res.status(200).json({ service });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/services/:id
// @access  Private (service_provider only, must own the service)
const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    if (service.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to delete this service' });
    }

    await service.deleteOne();
    res.status(200).json({ message: 'Service deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/services/mine
// @access  Private (service_provider only)
const getMyServices = async (req, res, next) => {
  try {
    const services = await Service.find({ provider: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ services });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/services
// @access  Public
// Query params: category, search, provider, page, limit
const getServices = async (req, res, next) => {
  try {
    const { category, search, provider, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };

    if (category && category !== 'All') {
      query.category = category;
    }
    if (provider) {
      if (!mongoose.Types.ObjectId.isValid(provider)) {
        return res.status(400).json({ message: 'Invalid provider id' });
      }
      query.provider = provider;
    }
    if (search) {
      query.$text = { $search: search };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const [services, total] = await Promise.all([
      Service.find(query)
        .select('-specs -description -images')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('provider', 'businessName businessAddress'),
      Service.countDocuments(query)
    ]);

    res.status(200).json({
      services,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/services/:id
// @access  Public
const getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id).populate(
      'provider',
      'businessName businessAddress phone'
    );

    if (!service || !service.isActive) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.status(200).json({ service });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createService,
  updateService,
  deleteService,
  getMyServices,
  getServices,
  getServiceById
};
