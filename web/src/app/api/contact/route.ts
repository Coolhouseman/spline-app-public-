import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, message, subject } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 }
      );
    }

    // Create a transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER, // Your Gmail address
        pass: process.env.GMAIL_APP_PASSWORD, // Your Gmail App Password
      },
    });

    // Send the email
    await transporter.sendMail({
      from: `"${name}" <${process.env.GMAIL_USER}>`, // Sender address (must be your authenticated Gmail)
      to: process.env.GMAIL_USER, // Send to yourself
      replyTo: email, // This allows you to click "Reply" and email the customer
      subject: `Inquiry: ${subject || 'General Inquiry'}`,
      text: `
        Name: ${name}
        Email: ${email}
        Phone: ${phone || 'Not provided'}
        Subject: ${subject}
        
        Message:
        ${message}
      `,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="border-bottom: 2px solid #333; padding-bottom: 10px;">New Website Inquiry</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <br/>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
            <strong>Message:</strong><br/>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `,
    });

    console.log("Email notification sent via Gmail.");

    return NextResponse.json({ success: true, message: "Inquiry received successfully." });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json({ success: false, message: "Failed to send inquiry." }, { status: 500 });
  }
}
