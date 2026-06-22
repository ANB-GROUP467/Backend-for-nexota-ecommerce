import User from "../models/User.js";
import Otp from "../models/Otp.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendOtp } from "../utils/sendOtp.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const sendUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || "",
  avatar: user.avatar || "",
  photoURL: user.photoURL || "",
  address: user.address || "",
  city: user.city || "",
  memberTier: user.memberTier || "Silver",
  points: user.points || 0,
  isVerified: user.isVerified ?? true,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const normalizeIdentifier = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isEmailIdentifier = (identifier) => /^\S+@\S+\.\S+$/.test(identifier);

const phoneToEmail = (phone) => {
  const digits = String(phone).replace(/\D/g, "");
  return `${digits || Date.now()}@phone.nexota.local`;
};

const findUserByIdentifier = async (identifier) => {
  if (isEmailIdentifier(identifier)) {
    return User.findOne({ email: identifier });
  }

  return User.findOne({
    $or: [{ phone: identifier }, { email: phoneToEmail(identifier) }],
  });
};

const createOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const createOtpRecord = async ({ identifier, mode }) => {
  const otp = createOtpCode();
  const otpHash = await bcrypt.hash(otp, 10);

  await Otp.deleteMany({ identifier, mode });

  await Otp.create({
    identifier,
    mode,
    otpHash,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  return otp;
};

const createOtpUser = async ({ identifier }) => {
  const isEmail = isEmailIdentifier(identifier);
  const email = isEmail ? identifier : phoneToEmail(identifier);
  const phone = isEmail ? "" : identifier;
  const name = isEmail
    ? identifier.split("@")[0].replace(/[._-]+/g, " ")
    : "Nexota Customer";
  const randomPassword = await bcrypt.hash(
    `${identifier}-${Date.now()}-${Math.random()}`,
    10,
  );

  return User.create({
    name,
    email,
    phone,
    password: randomPassword,
    isVerified: true,
  });
};

const sanitizeAddress = (address = {}) => ({
  label: String(address.label || "Home").trim(),
  fullName: String(address.fullName || address.name || "").trim(),
  email: String(address.email || "")
    .trim()
    .toLowerCase(),
  phone: String(address.phone || "").trim(),
  country: String(address.country || "Qatar").trim(),
  city: String(address.city || "").trim(),
  area: String(address.area || "").trim(),
  street: String(address.street || address.address || "").trim(),
  building: String(address.building || "").trim(),
  floor: String(address.floor || "").trim(),
  apartment: String(address.apartment || "").trim(),
  zone: String(address.zone || "").trim(),
  landmark: String(address.landmark || "").trim(),
  postalCode: String(address.postalCode || "").trim(),
  deliveryInstructions: String(address.deliveryInstructions || "").trim(),
  latitude: String(address.latitude || "").trim(),
  longitude: String(address.longitude || "").trim(),
  mapUrl: String(address.mapUrl || "").trim(),
  isDefault: Boolean(address.isDefault),
});

const validateAddress = (address) => {
  if (!address.fullName) return "Full name is required";
  if (!address.email) return "Email is required";
  if (!address.phone) return "Phone is required";
  if (!address.city) return "City is required";
  if (!address.area) return "Area is required";
  if (!address.street) return "Street is required";
  if (!address.building) return "Building / house number is required";
  return "";
};

export const requestOtp = async (req, res) => {
  try {
    const identifier = normalizeIdentifier(
      req.body.identifier || req.body.email || req.body.phone,
    );
    const mode = req.body.mode === "register" ? "register" : "login";

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Email or mobile number is required",
      });
    }

    if (mode === "login") {
      const user = await findUserByIdentifier(identifier);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found. Please sign up first.",
        });
      }
    }

    const otp = await createOtpRecord({ identifier, mode });
    const delivery = await sendOtp({ identifier, otp });

    res.json({
      success: true,
      message: delivery.sent
        ? "OTP sent successfully"
        : delivery.message || "OTP generated successfully",
      channel: delivery.channel,
      devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const identifier = normalizeIdentifier(
      req.body.identifier || req.body.email || req.body.phone,
    );
    const mode = req.body.mode === "register" ? "register" : "login";
    const otp = String(req.body.otp || "").trim();

    if (!identifier || !otp) {
      return res.status(400).json({
        success: false,
        message: "Identifier and OTP are required",
      });
    }

    const otpRecord = await Otp.findOne({
      identifier,
      mode,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found. Please request a new OTP.",
      });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await otpRecord.deleteOne();

      return res.status(429).json({
        success: false,
        message: "Too many wrong attempts. Please request a new OTP.",
      });
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);

    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    let user = await findUserByIdentifier(identifier);

    if (!user && mode === "login") {
      return res.status(404).json({
        success: false,
        message: "No account found. Please sign up first.",
      });
    }

    if (!user) {
      user = await createOtpUser({ identifier });
    } else {
      user.isVerified = true;
      await user.save({ validateBeforeSave: false });
    }

    await otpRecord.deleteOne();

    res.json({
      success: true,
      message: "OTP verified successfully",
      token: generateToken(user._id),
      user: sendUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      isVerified: true,
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: sendUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: sendUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select(
      "-password",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: sendUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const allowedFields = [
      "name",
      "phone",
      "avatar",
      "photoURL",
      "address",
      "city",
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();

      const exists = await User.findOne({
        email,
        _id: { $ne: userId },
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use",
        });
      }

      updates.email = email;
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: sendUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select(
      "addresses",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      addresses: user.addresses || [],
      data: user.addresses || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = sanitizeAddress(req.body);
    const error = validateAddress(address);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    if (!Array.isArray(user.addresses)) {
      user.addresses = [];
    }

    if (address.isDefault || user.addresses.length === 0) {
      user.addresses.forEach((item) => {
        item.isDefault = false;
      });
      address.isDefault = true;
    }

    user.addresses.push(address);
    await user.save();

    const createdAddress = user.addresses[user.addresses.length - 1];

    res.status(201).json({
      success: true,
      message: "Address saved successfully",
      address: createdAddress,
      data: createdAddress,
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = user.addresses?.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const updates = sanitizeAddress({ ...address.toObject(), ...req.body });
    const error = validateAddress(updates);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    Object.assign(address, updates);

    if (updates.isDefault) {
      user.addresses.forEach((item) => {
        item.isDefault = String(item._id) === String(address._id);
      });
    }

    await user.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      address,
      data: address,
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = user.addresses?.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const wasDefault = address.isDefault;
    address.deleteOne();

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.json({
      success: true,
      message: "Address deleted successfully",
      addresses: user.addresses,
      data: user.addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = user.addresses?.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    user.addresses.forEach((item) => {
      item.isDefault = String(item._id) === String(address._id);
    });

    await user.save();

    res.json({
      success: true,
      message: "Default address updated",
      address,
      data: address,
      addresses: user.addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const currentPassword = req.body.currentPassword || req.body.oldPassword;
    const newPassword = req.body.newPassword || req.body.password;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are required",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
