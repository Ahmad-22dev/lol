"use client"

import type React from "react"

import { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from "@solana/web3.js"
import { ToastContainer, toast } from "react-toastify"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Copy, Upload, Clock, Palette, Zap } from "lucide-react"
import "react-toastify/dist/ReactToastify.css"

// Your recipient wallet address
const RECIPIENT_WALLET = "6zhLuGqFfVfYsRNUrkXSMxhCpKK63JCJvFccosBBhqf8"

export default function Home() {
  const { publicKey, sendTransaction, connected } = useWallet()

  // Main form states
  const [contractAddress, setContractAddress] = useState("")
  const [bannerText, setBannerText] = useState("")
  const [bannerDescription, setBannerDescription] = useState("")
  const [email, setEmail] = useState("")
  const [telegram, setTelegram] = useState("")
  const [selectedOption, setSelectedOption] = useState("basic")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Manual payment states
  const [manualPaymentSignature, setManualPaymentSignature] = useState("")
  const [showManualPaymentForm, setShowManualPaymentForm] = useState(false)
  const [isVerifyingSignature, setIsVerifyingSignature] = useState(false)

  // Automatic payment flow
  const handlePayment = async () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first!")
      return
    }
    if (!contractAddress || !email) {
      toast.error("Please fill in the required fields")
      return
    }
    try {
      setIsSubmitting(true)
      toast.info("Initiating payment process...")

      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed")
      const amount = selectedOption === "basic" ? 0.1 * LAMPORTS_PER_SOL : 0.2 * LAMPORTS_PER_SOL

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(RECIPIENT_WALLET),
          lamports: amount,
        }),
      )

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signature = await sendTransaction(transaction, connection)
      toast.info("Transaction sent! Waiting for confirmation...")
      await connection.confirmTransaction(signature, "confirmed")

      toast.success("Payment successful! Submitting your banner request...")
      await submitBannerRequest(signature, false) // false = not manual
    } catch (error: any) {
      console.error("Payment error:", error)
      toast.error("Payment failed: " + (error.message || "Unknown error"))
      setIsSubmitting(false)
    }
  }

  // Submit banner request (for both automatic and manual flows)
  const submitBannerRequest = async (paymentSignature: string, manualPayment: boolean) => {
    const formData = new FormData()
    formData.append("contractAddress", contractAddress)
    formData.append("bannerText", bannerText)
    formData.append("bannerDescription", bannerDescription)
    formData.append("email", email)
    formData.append("telegram", telegram)
    formData.append("bannerType", selectedOption)
    formData.append("paymentSignature", paymentSignature)
    formData.append("manualPayment", manualPayment ? "true" : "false")

    if (logoFile) {
      formData.append("logo", logoFile)
    }
    if (screenshotFiles.length > 0) {
      screenshotFiles.forEach((file, index) => {
        formData.append(`screenshot_${index}`, file)
      })
    }

    try {
      const response = await fetch("/api/submit-banner", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        throw new Error("Failed to submit banner request")
      }
      const data = await response.json()
      toast.success("Banner request submitted successfully!")
      setPreviewUrl("/placeholder.svg?height=300&width=600")
      setIsSubmitting(false)
    } catch (error: any) {
      console.error("Submission error:", error)
      toast.error("Failed to submit banner request: " + error.message)
      setIsSubmitting(false)
    }
  }

  // Handle manual payment submission (verifies signature via /api/verify-transaction)
  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualPaymentSignature || !contractAddress || !email) {
      toast.error("Please fill in all required fields for manual payment")
      return
    }
    try {
      setIsVerifyingSignature(true)
      toast.info("Verifying transaction signature...")
      const response = await fetch("/api/verify-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature: manualPaymentSignature,
          bannerType: selectedOption,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to verify transaction")
      }
      toast.success("Transaction verified! Submitting your banner request...")
      await submitBannerRequest(manualPaymentSignature, true) // true = manual payment
      setShowManualPaymentForm(false)
    } catch (error: any) {
      console.error("Verification error:", error)
      toast.error("Verification failed: " + error.message)
    } finally {
      setIsVerifyingSignature(false)
    }
  }

  // File input handlers
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setLogoFile(e.target.files[0])
  }

  const handleScreenshotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setScreenshotFiles(Array.from(e.target.files))
  }

  // Copy-to-clipboard functionality for wallet address
  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Wallet address copied to clipboard!"))
      .catch((err) => {
        console.error("Failed to copy:", err)
        toast.error("Failed to copy address")
      })
  }

  // Open manual payment form
  const handleManualPaymentInstructions = () => {
    setShowManualPaymentForm(true)
    toast.info(
      "Please send " +
        (selectedOption === "basic" ? "0.1" : "0.2") +
        " SOL to the address below and then submit your transaction signature.",
    )
  }

  // Reset form
  const resetForm = () => {
    setPreviewUrl(null)
    setContractAddress("")
    setBannerText("")
    setBannerDescription("")
    setEmail("")
    setTelegram("")
    setLogoFile(null)
    setScreenshotFiles([])
    setShowManualPaymentForm(false)
    setManualPaymentSignature("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 text-white">
      <ToastContainer position="top-right" theme="dark" />

      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          Banner<span className="text-yellow-400">SOL</span>
        </h1>
        <div className="wallet-adapter-button-container">
          <WalletMultiButton className="!bg-yellow-500 hover:!bg-yellow-600" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto bg-gray-800/50 backdrop-blur-sm shadow-xl border-gray-700">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6 text-center">Create Your Custom Solana Project Banner</h2>

            {previewUrl ? (
              <div className="mb-8 text-center">
                <h3 className="text-xl font-bold mb-4">Your Banner Preview</h3>
                <div className="bg-gray-700 p-4 rounded-lg inline-block">
                  <img
                    src={previewUrl || "/placeholder.svg"}
                    alt="Banner Preview"
                    className="max-w-full h-auto rounded"
                  />
                </div>
                <p className="mt-4">Your banner will be sent to {email} once it's ready!</p>
                <Button onClick={resetForm} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  Create Another Banner
                </Button>
              </div>
            ) : showManualPaymentForm ? (
              <div className="space-y-6">
                <div className="p-4 bg-gray-700 rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Manual Payment Instructions</h3>
                  <p className="mb-2">
                    Please send{" "}
                    <span className="font-bold text-yellow-400">{selectedOption === "basic" ? "0.1" : "0.2"} SOL</span>{" "}
                    to the following address:
                  </p>
                  <div className="flex items-center space-x-2 p-3 bg-gray-800 rounded-lg mb-4">
                    <span className="text-sm font-mono break-all">{RECIPIENT_WALLET}</span>
                    <Button
                      onClick={() => copyToClipboard(RECIPIENT_WALLET)}
                      variant="outline"
                      size="icon"
                      className="ml-2 bg-yellow-500 text-gray-900 hover:bg-yellow-600 border-none"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex justify-center mb-4">
                    <QRCodeSVG value={RECIPIENT_WALLET} size={150} bgColor="#1f2937" fgColor="#ffffff" />
                  </div>

                  <div className="bg-yellow-900/30 border border-yellow-400 p-3 rounded-lg mb-4">
                    <p className="text-sm">✓ After sending the payment, submit your transaction signature below.</p>
                    <p className="text-sm mt-2">✓ You can find your signature in your wallet's transaction history.</p>
                  </div>

                  <form onSubmit={handleManualPaymentSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="manualPaymentSignature" className="block text-sm font-medium mb-1">
                        Transaction Signature <span className="text-red-400">*</span>
                      </label>
                      <Input
                        type="text"
                        id="manualPaymentSignature"
                        value={manualPaymentSignature}
                        onChange={(e) => setManualPaymentSignature(e.target.value)}
                        className="w-full p-3 bg-gray-700 focus:ring-2 focus:ring-yellow-400 focus:outline-none border-gray-600"
                        placeholder="Paste your transaction signature here"
                        required
                      />
                    </div>
                    <div className="flex space-x-3">
                      <Button
                        type="button"
                        onClick={() => setShowManualPaymentForm(false)}
                        variant="outline"
                        className="border-gray-600"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={isVerifyingSignature}
                        className="flex-1 bg-yellow-500 text-gray-900 hover:bg-yellow-600"
                      >
                        {isVerifyingSignature ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Verify & Submit"
                        )}
                      </Button>
                    </div>
                  </form>

                  <div className="mt-4">
                    <h3 className="font-bold text-lg">FAQs</h3>
                    <ul className="list-disc ml-6 text-sm">
                      <li>
                        <strong>How do I find my transaction signature?</strong> Check your wallet's transaction
                        history.
                      </li>
                      <li>
                        <strong>Need help?</strong> Email us at{" "}
                        <a href="mailto:solbannerr@gmail.com" className="text-blue-400 underline">
                          solbannerr@gmail.com
                        </a>
                        .
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              // Main form when not in manual mode
              <div className="space-y-6">
                <Tabs defaultValue="basic" onValueChange={setSelectedOption}>
                  <TabsList className="grid w-full grid-cols-2 bg-gray-700">
                    <TabsTrigger
                      value="basic"
                      className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900"
                    >
                      Basic
                    </TabsTrigger>
                    <TabsTrigger
                      value="premium"
                      className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900"
                    >
                      Premium
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="basic" className="mt-4 p-4 border rounded-lg border-gray-700">
                    <div className="text-center">
                      <h3 className="font-bold">Basic Banner</h3>
                      <p className="text-xl font-bold text-yellow-400">0.1 SOL</p>
                      <p className="text-sm text-gray-300 mt-2">Standard banner with logo and text</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="premium" className="mt-4 p-4 border rounded-lg border-gray-700">
                    <div className="text-center">
                      <h3 className="font-bold">Premium Banner</h3>
                      <p className="text-xl font-bold text-yellow-400">0.2 SOL</p>
                      <p className="text-sm text-gray-300 mt-2">Custom design with screenshots and effects</p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="contractAddress" className="block text-sm font-medium mb-1">
                        Contract Address (CA) <span className="text-red-400">*</span>
                      </label>
                      <Input
                        type="text"
                        id="contractAddress"
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        className="bg-gray-700 border-gray-600"
                        placeholder="Enter your project's contract address"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="bannerText" className="block text-sm font-medium mb-1">
                        Banner Text
                      </label>
                      <Textarea
                        id="bannerText"
                        value={bannerText}
                        onChange={(e) => setBannerText(e.target.value)}
                        className="bg-gray-700 border-gray-600"
                        placeholder="Text to appear on your banner"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label htmlFor="bannerDescription" className="block text-sm font-medium mb-1">
                        Banner Description <span className="text-yellow-400">(New!)</span>
                      </label>
                      <Textarea
                        id="bannerDescription"
                        value={bannerDescription}
                        onChange={(e) => setBannerDescription(e.target.value)}
                        className="bg-gray-700 border-gray-600"
                        placeholder="Describe how you want your banner to look (colors, style, layout, etc.)"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-1">
                        Email <span className="text-red-400">*</span>
                      </label>
                      <Input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-gray-700 border-gray-600"
                        placeholder="Where to send your banner"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="telegram" className="block text-sm font-medium mb-1">
                        Telegram Handle (Optional)
                      </label>
                      <Input
                        type="text"
                        id="telegram"
                        value={telegram}
                        onChange={(e) => setTelegram(e.target.value)}
                        className="bg-gray-700 border-gray-600"
                        placeholder="Your Telegram username"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">Project Logo</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-lg">
                      <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-400 justify-center">
                          <label
                            htmlFor="logo-upload"
                            className="relative cursor-pointer bg-gray-700 rounded-md font-medium text-yellow-400 hover:text-yellow-300 focus-within:outline-none px-2"
                          >
                            <span>Upload a file</span>
                            <input
                              id="logo-upload"
                              name="logo-upload"
                              type="file"
                              className="sr-only"
                              onChange={handleLogoChange}
                              accept="image/*"
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-400">PNG, JPG, GIF up to 5MB</p>
                        {logoFile && <p className="text-sm text-green-400">{logoFile.name}</p>}
                      </div>
                    </div>
                  </div>

                  {selectedOption === "premium" && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Screenshots (Premium only)</label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-lg">
                        <div className="space-y-1 text-center">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="flex text-sm text-gray-400 justify-center">
                            <label
                              htmlFor="screenshots-upload"
                              className="relative cursor-pointer bg-gray-700 rounded-md font-medium text-yellow-400 hover:text-yellow-300 focus-within:outline-none px-2"
                            >
                              <span>Upload files</span>
                              <input
                                id="screenshots-upload"
                                name="screenshots-upload"
                                type="file"
                                className="sr-only"
                                onChange={handleScreenshotsChange}
                                multiple
                                accept="image/*"
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-400">Up to 3 screenshots (PNG, JPG, GIF)</p>
                          {screenshotFiles.length > 0 && (
                            <p className="text-sm text-green-400">{screenshotFiles.length} file(s) selected</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-600 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <p className="text-lg font-bold">
                      Total: <span className="text-yellow-400">{selectedOption === "basic" ? "0.1" : "0.2"} SOL</span>
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleManualPaymentInstructions}
                      variant="outline"
                      className="border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-gray-900"
                    >
                      Manual Payment
                    </Button>
                    <Button
                      onClick={handlePayment}
                      disabled={isSubmitting || !connected}
                      className={`${
                        connected ? "bg-yellow-500 hover:bg-yellow-600 text-gray-900" : "bg-gray-600 text-gray-300"
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Pay with Connected Wallet"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="max-w-4xl mx-auto mt-12 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-yellow-500 text-gray-900 mb-4">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium mb-2">Simple Payment</h3>
                <p className="text-gray-300">
                  Pay with just 0.1 or 0.2 SOL using your connected wallet or send manually to our address.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-yellow-500 text-gray-900 mb-4">
                  <Palette className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium mb-2">Custom Designs</h3>
                <p className="text-gray-300">
                  Get professional banners customized with your project's branding, logos, and screenshots.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-yellow-500 text-gray-900 mb-4">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium mb-2">Fast Delivery</h3>
                <p className="text-gray-300">
                  Receive your custom banner quickly via email after your payment is confirmed.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 mt-auto">
        <div className="border-t border-gray-700 pt-6 text-center text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} BannerSOL. All rights reserved.</p>
          <p className="mt-2">Powered by Solana Blockchain</p>
          <p className="mt-2">
            Contact:{" "}
            <a href="mailto:solbannerr@gmail.com" className="hover:text-blue-400">
              solbannerr@gmail.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

