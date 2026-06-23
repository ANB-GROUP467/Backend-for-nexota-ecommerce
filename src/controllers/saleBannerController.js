import SaleBanner from "../models/SaleBanner.js";

const activeWindowQuery = () => {
  const now = new Date();
  return {
    isActive: true,
    $and: [
      {
        $or: [
          { startAt: null },
          { startAt: { $exists: false } },
          { startAt: { $lte: now } },
        ],
      },
      {
        $or: [
          { endAt: null },
          { endAt: { $exists: false } },
          { endAt: { $gte: now } },
        ],
      },
    ],
  };
};

export const createSaleBanner = async (req, res) => {
  try {
    const banner = await SaleBanner.create(req.body);
    res.status(201).json({ success: true, banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSaleBanners = async (req, res) => {
  try {
    const banners = await SaleBanner.find().sort({
      priority: -1,
      createdAt: -1,
    });
    res.json({ success: true, banners, saleBanners: banners, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveSaleBanners = async (req, res) => {
  try {
    const query = activeWindowQuery();
    if (req.query.placement) query.placement = req.query.placement;

    const banners = await SaleBanner.find(query).sort({
      priority: -1,
      createdAt: -1,
    });
    res.json({ success: true, banners, saleBanners: banners, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSaleBannerById = async (req, res) => {
  try {
    const banner = await SaleBanner.findById(req.params.id);
    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: "Sale banner not found" });
    }
    res.json({ success: true, banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSaleBanner = async (req, res) => {
  try {
    const banner = await SaleBanner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: "Sale banner not found" });
    }
    res.json({ success: true, banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSaleBanner = async (req, res) => {
  try {
    const banner = await SaleBanner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: "Sale banner not found" });
    }
    res.json({ success: true, message: "Sale banner deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
