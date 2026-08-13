const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetEmail = async ({ to, resetToken, resetUrl }) => {
  const from = process.env.EMAIL_FROM || 'RevvUp <onboarding@resend.dev>';

  await resend.emails.send({
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