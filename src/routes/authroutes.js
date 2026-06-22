import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  registerUser,
  loginUser,
  requestOtp,
  verifyOtp,
  getMe,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  changePassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

router.post("/request-otp", requestOtp);
router.post("/send-otp", requestOtp);
router.post("/otp/send", requestOtp);

router.post("/verify-otp", verifyOtp);
router.post("/otp/verify", verifyOtp);

router.get("/me", protect, getMe);
router.get("/profile", protect, getMe);

router.put("/me", protect, updateProfile);
router.put("/profile", protect, updateProfile);

router.get("/addresses", protect, getAddresses);
router.post("/addresses", protect, addAddress);
router.put("/addresses/:addressId", protect, updateAddress);
router.delete("/addresses/:addressId", protect, deleteAddress);
router.patch("/addresses/:addressId/default", protect, setDefaultAddress);

router.put("/change-password", protect, changePassword);
router.put("/password", protect, changePassword);

export default router;
