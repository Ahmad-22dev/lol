import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import Mailjet from "node-mailjet"

export async function POST(request: Request) {
  try {
    // Initialize Mailjet with your API keys
    const mailjet = Mailjet.apiConnect(process.env.MAILJET_API_KEY || "", process.env.MAILJET_SECRET_KEY || "")

    const formData = await request.formData()

    const contractAddress = formData.get("contractAddress") as string
    const bannerText = formData.get("bannerText") as string
    const bannerDescription = formData.get("bannerDescription") as string
    const email = formData.get("email") as string
    const telegram = formData.get("telegram") as string
    const bannerType = formData.get("bannerType") as string
    const paymentSignature = formData.get("paymentSignature") as string
    const manualPayment = formData.get("manualPayment") === "true"

    // Generate a unique request ID
    const requestId = uuidv4()

    // Handle logo upload
    const logo = formData.get("logo") as File | null
    let logoPath = null
    let logoDetails = "No logo uploaded"

    if (logo) {
      const bytes = await logo.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // In a real app, you'd use a storage service like AWS S3 or Vercel Blob
      logoPath = `logo-${requestId}-${logo.name}`
      logoDetails = `Logo: ${logo.name} (${logo.size} bytes)`
    }

    // Handle screenshots (for premium banners)
    const screenshotPaths = []
    let screenshotDetails = "No screenshots uploaded"

    if (bannerType === "premium") {
      const screenshotInfo = []
      for (let i = 0; i < 3; i++) {
        const screenshot = formData.get(`screenshot_${i}`) as File | null

        if (screenshot) {
          const bytes = await screenshot.arrayBuffer()
          const buffer = Buffer.from(bytes)

          screenshotPaths.push(`screenshot-${i}-${requestId}-${screenshot.name}`)
          screenshotInfo.push(`Screenshot ${i + 1}: ${screenshot.name} (${screenshot.size} bytes)`)
        }
      }

      if (screenshotInfo.length > 0) {
        screenshotDetails = screenshotInfo.join("<br>")
      }
    }

    // Format the current date and time
    const orderDate = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    })

    // Prepare HTML email content for admin notification
    const adminHtmlContent = `
      <h1>New Banner Order</h1>
      <p><strong>Order ID:</strong> ${requestId}</p>
      <p><strong>Date:</strong> ${orderDate}</p>
      
      <h2>Customer Details</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Telegram:</strong> ${telegram || "Not provided"}</p>
      
      <h2>Banner Details</h2>
      <p><strong>Type:</strong> ${bannerType.toUpperCase()}</p>
      <p><strong>Contract Address:</strong> ${contractAddress}</p>
      <p><strong>Banner Text:</strong> ${bannerText || "Not provided"}</p>
      
      <h2>Design Instructions</h2>
      <p style="white-space: pre-line;">${bannerDescription || "No specific design instructions provided"}</p>
      
      <h2>Payment Details</h2>
      <p><strong>Method:</strong> ${manualPayment ? "Manual Payment" : "Direct Wallet Payment"}</p>
      <p><strong>Transaction Signature:</strong> ${paymentSignature}</p>
      <p><strong>Amount:</strong> ${bannerType === "basic" ? "0.1" : "0.2"} SOL</p>
      
      <h2>Uploaded Files</h2>
      <p>${logoDetails}</p>
      ${bannerType === "premium" ? `<p>${screenshotDetails}</p>` : ""}
    `

    // Prepare text email content for admin notification
    const adminTextContent = `
      NEW BANNER ORDER
      ----------------
      Order ID: ${requestId}
      Date: ${orderDate}
      
      CUSTOMER DETAILS
      ----------------
      Email: ${email}
      Telegram: ${telegram || "Not provided"}
      
      BANNER DETAILS
      --------------
      Type: ${bannerType.toUpperCase()}
      Contract Address: ${contractAddress}
      Banner Text: ${bannerText || "Not provided"}
      
      DESIGN INSTRUCTIONS
      ------------------
      ${bannerDescription || "No specific design instructions provided"}
      
      PAYMENT DETAILS
      --------------
      Method: ${manualPayment ? "Manual Payment" : "Direct Wallet Payment"}
      Transaction Signature: ${paymentSignature}
      Amount: ${bannerType === "basic" ? "0.1" : "0.2"} SOL
      
      UPLOADED FILES
      -------------
      ${logoDetails}
      ${bannerType === "premium" ? screenshotDetails.replace(/<br>/g, "\n") : ""}
    `

    try {
      // Send admin notification email using Mailjet
      const adminRequest = mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "noreply@yourdomain.com",
              Name: "BannerSOL",
            },
            To: [
              {
                Email: "solbannerr@gmail.com",
                Name: "BannerSOL Admin",
              },
            ],
            Subject: `New Banner Order: ${bannerType.toUpperCase()} - ${requestId}`,
            TextPart: adminTextContent,
            HTMLPart: adminHtmlContent,
          },
        ],
      })

      await adminRequest
      console.log(`Banner order notification sent to solbannerr@gmail.com (Order ID: ${requestId})`)

      // Prepare HTML email content for customer confirmation
      const customerHtmlContent = `
        <h1>Thank you for your order!</h1>
        
        <p>Your banner request has been received and is being processed. We'll create your custom ${bannerType} banner as soon as possible.</p>
        
        <h2>Order Details:</h2>
        <ul>
          <li><strong>Order ID:</strong> ${requestId}</li>
          <li><strong>Banner Type:</strong> ${bannerType.toUpperCase()}</li>
          <li><strong>Amount Paid:</strong> ${bannerType === "basic" ? "0.1" : "0.2"} SOL</li>
        </ul>
        
        <p>We'll send your completed banner to this email address when it's ready.</p>
        
        <p>If you have any questions, please contact us at <a href="mailto:solbannerr@gmail.com">solbannerr@gmail.com</a>.</p>
        
        <p>Thank you for choosing BannerSOL!</p>
      `

      // Prepare text email content for customer confirmation
      const customerTextContent = `
        Thank you for your order!
        
        Your banner request has been received and is being processed. We'll create your custom ${bannerType} banner as soon as possible.
        
        Order Details:
        - Order ID: ${requestId}
        - Banner Type: ${bannerType.toUpperCase()}
        - Amount Paid: ${bannerType === "basic" ? "0.1" : "0.2"} SOL
        
        We'll send your completed banner to this email address when it's ready.
        
        If you have any questions, please contact us at solbannerr@gmail.com.
        
        Thank you for choosing BannerSOL!
      `

      // Send customer confirmation email
      const customerRequest = mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "noreply@yourdomain.com",
              Name: "BannerSOL",
            },
            To: [
              {
                Email: email,
                Name: email.split("@")[0], // Use part before @ as name
              },
            ],
            Subject: `Your BannerSOL Order Confirmation - ${requestId}`,
            TextPart: customerTextContent,
            HTMLPart: customerHtmlContent,
          },
        ],
      })

      await customerRequest
      console.log(`Confirmation email sent to customer: ${email}`)
    } catch (emailError) {
      console.error("Error sending email:", emailError)
      // Continue with the process even if email fails
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Banner request submitted successfully",
      requestId: requestId,
      details: {
        contractAddress,
        bannerType,
        paymentSignature,
        manualPayment,
        logoPath,
        screenshotPaths,
      },
    })
  } catch (error) {
    console.error("Error processing banner request:", error)
    return NextResponse.json({ error: "Failed to process banner request" }, { status: 500 })
  }
}

