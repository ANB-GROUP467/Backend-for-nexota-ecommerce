const isEmail = (value) => /^\S+@\S+\.\S+$/.test(value);

export const sendOtp = async ({ identifier, otp }) => {
  const message = `Your Nexota OTP is ${otp}. It will expire in 10 minutes.`;

  if (!isEmail(identifier)) {
    console.log(`[Nexota OTP] ${identifier}: ${otp}`);
    return {
      sent: false,
      channel: "console",
      message: "SMS provider not configured. OTP printed in backend console.",
    };
  }

  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.log(`[Nexota OTP] ${identifier}: ${otp}`);
    return {
      sent: false,
      channel: "console",
      message: "SMTP not configured. OTP printed in backend console.",
    };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: identifier,
      subject: "Your Nexota OTP",
      text: message,
      html: `<p>${message}</p>`,
    });

    return {
      sent: true,
      channel: "email",
      message: "OTP sent successfully.",
    };
  } catch (error) {
    console.log(`[Nexota OTP] ${identifier}: ${otp}`);
    console.error("OTP email error:", error.message);

    return {
      sent: false,
      channel: "console",
      message: "Email failed. OTP printed in backend console.",
    };
  }
};
