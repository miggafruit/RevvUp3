const { Resend } = require('resend');

// Previously `new Resend(process.env.RESEND_API_KEY)` ran at module
// load time, and Resend's constructor throws synchronously if the key
// is missing/empty — meaning the ENTIRE SERVER failed to boot the
// moment this file was required (sendEmail.js is required by
// authController.js, which is required by every route file), not just
// password-reset emails. Lazy construction means the app starts fine
// without the key (as validateEnv.js's "recommended, not required"
// classification always intended), and only the actual attempt to
// send an email fails — with a clear error, not a boot crash.
let resendClient = null;
const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set — cannot send email.');
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

const sendPasswordResetEmail = async ({ to, resetToken, resetUrl }) => {
  const from = process.env.EMAIL_FROM || 'RevvUp <onboarding@resend.dev>';

  await getResendClient().emails.send({
    from,
    to,
    subject: 'Reset your RevvUp password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 4px;">Reset your password</h2>
        <p>We received a request to reset the password for your RevvUp account.</p>
        <p>Enter this 6-digit code in the app to continue:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; background: #f4f4f4; padding: 18px 16px; border-radius: 8px; text-align: center;">
          ${resetToken}
        </p>
        ${resetUrl ? `<p>Or open this link on your device:</p><p><a href="${resetUrl}">${resetUrl}</a></p>` : ''}
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `
  });
};

module.exports = { sendPasswordResetEmail };