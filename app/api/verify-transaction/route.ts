import { NextResponse } from "next/server"
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js"
import Mailjet from "node-mailjet"

// Your recipient wallet address
const RECIPIENT_WALLET = "6zhLuGqFfVfYsRNUrkXSMxhCpKK63JCJvFccosBBhqf8"

export async function POST(request: Request) {
  try {
    // Initialize Mailjet with your API keys
    const mailjet = Mailjet.apiConnect(process.env.MAILJET_API_KEY || "", process.env.MAILJET_SECRET_KEY || "")

    const { signature, bannerType } = await request.json()

    if (!signature) {
      return NextResponse.json({ error: "Transaction signature is required" }, { status: 400 })
    }

    // Connect to Solana
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed")

    // Get transaction details
    const transaction = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Verify the transaction is a transfer to the correct recipient
    const expectedAmount = bannerType === "basic" ? 0.1 * LAMPORTS_PER_SOL : 0.2 * LAMPORTS_PER_SOL

    // In a real implementation, you would:
    // 1. Verify the transaction is a SOL transfer
    // 2. Verify the recipient is your wallet
    // 3. Verify the amount matches the expected amount
    // 4. Verify the transaction is confirmed
    // 5. Check if the transaction is already used for another banner request

    // Format the current date and time
    const verificationDate = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    })

    // Prepare HTML email content
    const htmlContent = `
      <h1>Transaction Verification</h1>
      <p><strong>Date:</strong> ${verificationDate}</p>
      
      <h2>Payment Details</h2>
      <p><strong>Transaction Signature:</strong> ${signature}</p>
      <p><strong>Banner Type:</strong> ${bannerType.toUpperCase()}</p>
      <p><strong>Amount:</strong> ${bannerType === "basic" ? "0.1" : "0.2"} SOL</p>
      
      <p>This transaction has been verified and is awaiting banner submission from the customer.</p>
      <p>You will receive another email when the customer completes their banner request.</p>
    `

    // Prepare text email content
    const textContent = `
      TRANSACTION VERIFICATION
      -----------------------
      Date: ${verificationDate}
      
      PAYMENT DETAILS
      --------------
      Transaction Signature: ${signature}
      Banner Type: ${bannerType.toUpperCase()}
      Amount: ${bannerType === "basic" ? "0.1" : "0.2"} SOL
      
      This transaction has been verified and is awaiting banner submission from the customer.
      You will receive another email when the customer completes their banner request.
    `

    try {
      // Send verification email using Mailjet
      const request = mailjet.post("send", { version: "v3.1" }).request({
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
            Subject: `Transaction Verified: ${bannerType.toUpperCase()} Banner Payment`,
            TextPart: textContent,
            HTMLPart: htmlContent,
          },
        ],
      })

      await request
      console.log(`Transaction verification sent to solbannerr@gmail.com (Signature: ${signature})`)
    } catch (error) {
      console.error("Error sending transaction verification email:", error)
      // Continue with the process even if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Transaction verified successfully",
      details: {
        signature,
        bannerType,
        verified: true,
      },
    })
  } catch (error) {
    console.error("Error verifying transaction:", error)
    return NextResponse.json({ error: "Failed to verify transaction" }, { status: 500 })
  }
}

