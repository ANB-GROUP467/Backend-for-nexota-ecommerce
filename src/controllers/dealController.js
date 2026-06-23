import Deal from "../models/Deal.js";

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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

export const createDeal = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      slug: req.body.slug || toSlug(req.body.title),
    };
    const deal = await Deal.create(payload);
    res.status(201).json({ success: true, deal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDeals = async (req, res) => {
  try {
    const deals = await Deal.find()
      .populate("products", "title slug price oldPrice stock images image")
      .sort({ priority: -1, createdAt: -1 });
    res.json({ success: true, deals, data: deals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveDeals = async (req, res) => {
  try {
    const deals = await Deal.find(activeWindowQuery())
      .populate("products", "title slug price oldPrice stock images image")
      .sort({ priority: -1, createdAt: -1 });
    res.json({ success: true, deals, data: deals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDealById = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id).populate(
      "products",
      "title slug price oldPrice stock images image",
    );
    if (!deal) {
      return res
        .status(404)
        .json({ success: false, message: "Deal not found" });
    }
    res.json({ success: true, deal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDealBySlug = async (req, res) => {
  try {
    const deal = await Deal.findOne({ slug: req.params.slug }).populate(
      "products",
      "title slug price oldPrice stock images image",
    );
    if (!deal) {
      return res
        .status(404)
        .json({ success: false, message: "Deal not found" });
    }
    res.json({ success: true, deal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDeal = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      ...(req.body.title && !req.body.slug
        ? { slug: toSlug(req.body.title) }
        : {}),
    };
    const deal = await Deal.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });
    if (!deal) {
      return res
        .status(404)
        .json({ success: false, message: "Deal not found" });
    }
    res.json({ success: true, deal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) {
      return res
        .status(404)
        .json({ success: false, message: "Deal not found" });
    }
    res.json({ success: true, message: "Deal deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
