import Deal from "../models/Deal.js";

const sendSuccess = (res, payload = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    ...payload,
  });
};

const sendError = (res, error, status = 500) => {
  return res.status(status).json({
    success: false,
    message: error.message || "Something went wrong",
  });
};

const normalizeProducts = (products) => {
  if (typeof products === "string") {
    try {
      products = JSON.parse(products);
    } catch {
      products = [];
    }
  }

  if (!Array.isArray(products)) return [];

  return products
    .map((item) => ({
      product: item.product || item._id || item.id,
      quantity: Number(item.quantity || 1),
    }))
    .filter((item) => item.product);
};

const buildDealPayload = (body, file) => {
  const payload = {
    title: body.title,
    slug: body.slug,
    description: body.description,
    image: file?.path || body.image,
    products: normalizeProducts(body.products),
    originalPrice: Number(body.originalPrice),
    dealPrice: Number(body.dealPrice),
    stock: Number(body.stock || 0),
    badge: body.badge || "Deal",
    featured: body.featured === "true" || body.featured === true,
    status: body.status || "active",
    startsAt: body.startsAt || undefined,
    endsAt: body.endsAt || undefined,
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === "") {
      delete payload[key];
    }
  });

  return payload;
};

export const createDeal = async (req, res) => {
  try {
    const payload = buildDealPayload(req.body, req.file);

    const deal = await Deal.create(payload);

    const populatedDeal = await Deal.findById(deal._id).populate(
      "products.product",
      "title slug images price oldPrice stock status brand category",
    );

    return sendSuccess(
      res,
      {
        message: "Deal created successfully",
        deal: populatedDeal,
        data: populatedDeal,
      },
      201,
    );
  } catch (error) {
    return sendError(res, error, 400);
  }
};

export const getDeals = async (req, res) => {
  try {
    const { status, featured } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (featured) filter.featured = featured === "true";

    const deals = await Deal.find(filter)
      .populate(
        "products.product",
        "title slug images price oldPrice stock status brand category",
      )
      .sort({ createdAt: -1 });

    return sendSuccess(res, {
      message: "Deals fetched successfully",
      deals,
      data: deals,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getDealById = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id).populate(
      "products.product",
      "title slug images price oldPrice stock status brand category",
    );

    if (!deal) {
      return sendError(res, new Error("Deal not found"), 404);
    }

    return sendSuccess(res, { deal, data: deal });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getDealBySlug = async (req, res) => {
  try {
    const deal = await Deal.findOne({ slug: req.params.slug }).populate(
      "products.product",
      "title slug images price oldPrice stock status brand category",
    );

    if (!deal) {
      return sendError(res, new Error("Deal not found"), 404);
    }

    return sendSuccess(res, { deal, data: deal });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateDeal = async (req, res) => {
  try {
    const payload = buildDealPayload(req.body, req.file);

    const deal = await Deal.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    }).populate(
      "products.product",
      "title slug images price oldPrice stock status brand category",
    );

    if (!deal) {
      return sendError(res, new Error("Deal not found"), 404);
    }

    return sendSuccess(res, {
      message: "Deal updated successfully",
      deal,
      data: deal,
    });
  } catch (error) {
    return sendError(res, error, 400);
  }
};

export const deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);

    if (!deal) {
      return sendError(res, new Error("Deal not found"), 404);
    }

    return sendSuccess(res, {
      message: "Deal deleted successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};
