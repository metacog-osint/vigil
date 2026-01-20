import { useState, useEffect } from 'react'
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  TotpMultiFactorGenerator,
  TotpSecret,
  RecaptchaVerifier,
  getAuth,
} from 'firebase/auth'
import { formatDistanceToNow } from 'date-fns'

// Security settings component for 2FA and session management
export default function SecuritySettings({ user }) {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaEnrolled, setMfaEnrolled] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    if (user) {
      checkMfaStatus()
      loadSessions()
    }
  }, [user])

  async function checkMfaStatus() {
    setLoading(true)
    try {
      const multiFactorUser = multiFactor(user)
      const enrolledFactors = multiFactorUser.enrolledFactors
      setMfaEnrolled(enrolledFactors)
      setMfaEnabled(enrolledFactors.length > 0)
    } catch (error) {
      console.error('Error checking MFA status:', error)
    }
    setLoading(false)
  }

  function loadSessions() {
    // Get session info from localStorage/metadata
    // In production, you'd track this server-side
    const currentSession = {
      id: 'current',
      device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
      browser: getBrowserName(),
      lastActive: new Date().toISOString(),
      current: true,
    }
    setSessions([currentSession])
  }

  function getBrowserName() {
    const ua = navigator.userAgent
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Safari')) return 'Safari'
    if (ua.includes('Edge')) return 'Edge'
    return 'Unknown Browser'
  }

  async function handleUnenrollMfa(factorUid) {
    if (
      !confirm('Are you sure you want to disable 2FA? This will make your account less secure.')
    ) {
      return
    }

    try {
      const multiFactorUser = multiFactor(user)
      const factor = mfaEnrolled.find((f) => f.uid === factorUid)
      if (factor) {
        await multiFactorUser.unenroll(factor)
        await checkMfaStatus()
      }
    } catch (error) {
      console.error('Error unenrolling MFA:', error)
      alert('Failed to disable 2FA. You may need to re-authenticate.')
    }
  }

  if (!user) {
    return (
      <div className="cyber-card">
        <h3 className="text-lg font-semibold text-white mb-2">Security Settings</h3>
        <p className="text-gray-400 text-sm">Sign in to manage security settings.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Two-Factor Authentication */}
      <div className="cyber-card">
        <h3 className="text-lg font-semibold text-white mb-4">Two-Factor Authentication</h3>

        {loading ? (
          <p className="text-gray-400 text-sm">Checking 2FA status...</p>
        ) : mfaEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <svg
                className="w-5 h-5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <div>
                <div className="text-green-400 font-medium">2FA is enabled</div>
                <div className="text-gray-400 text-sm">
                  Your account is protected with an additional layer of security.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-400">Enrolled Methods</h4>
              {mfaEnrolled.map((factor) => (
                <div
                  key={factor.uid}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {factor.factorId === 'totp' ? (
                      <svg
                        className="w-5 h-5 text-cyber-accent"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-cyber-accent"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                    <div>
                      <div className="text-white text-sm">
                        {factor.displayName ||
                          (factor.factorId === 'totp' ? 'Authenticator App' : 'Phone')}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {factor.factorId === 'phone'
                          ? 'SMS Verification'
                          : factor.factorId === 'totp'
                            ? 'Time-based One-Time Password'
                            : factor.factorId}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnenrollMfa(factor.uid)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <svg
                className="w-5 h-5 text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <div className="text-yellow-400 font-medium">2FA is not enabled</div>
                <div className="text-gray-400 text-sm">
                  Add an extra layer of security to your account.
                </div>
              </div>
            </div>

            <button onClick={() => setShowEnrollModal(true)} className="cyber-button-primary">
              Enable Two-Factor Authentication
            </button>
          </div>
        )}

        {showEnrollModal && (
          <MfaEnrollModal
            user={user}
            onClose={() => setShowEnrollModal(false)}
            onSuccess={() => {
              setShowEnrollModal(false)
              checkMfaStatus()
            }}
          />
        )}
      </div>

      {/* Active Sessions */}
      <div className="cyber-card">
        <h3 className="text-lg font-semibold text-white mb-4">Active Sessions</h3>

        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {session.device === 'Mobile' ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  )}
                </svg>
                <div>
                  <div className="text-white text-sm">
                    {session.browser} on {session.device}
                    {session.current && <span className="ml-2 badge-info text-xs">Current</span>}
                  </div>
                  <div className="text-gray-500 text-xs">
                    Last active{' '}
                    {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                  </div>
                </div>
              </div>
              {!session.current && (
                <button className="text-red-400 hover:text-red-300 text-sm">Revoke</button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-gray-500 text-sm mb-3">
            If you notice any suspicious activity, you can sign out of all other sessions.
          </p>
          <button className="cyber-button text-sm">Sign Out All Other Sessions</button>
        </div>
      </div>

      {/* Login History */}
      <div className="cyber-card">
        <h3 className="text-lg font-semibold text-white mb-4">Login History</h3>
        <p className="text-gray-400 text-sm">
          Your recent login activity will appear here. This feature tracks login attempts to help
          you identify unauthorized access.
        </p>
        <div className="mt-4 p-4 bg-gray-800/30 rounded-lg text-center">
          <p className="text-gray-500 text-sm">No login history available yet.</p>
        </div>
      </div>
    </div>
  )
}

function MfaEnrollModal({ user, onClose, onSuccess }) {
  const [method, setMethod] = useState(null) // null = select, 'phone', 'totp'
  const [step, setStep] = useState('select') // select, phone, phone-verify, totp-setup, totp-verify
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [totpSecret, setTotpSecret] = useState(null)
  const [totpUri, setTotpUri] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSelectMethod(selectedMethod) {
    setMethod(selectedMethod)
    setError(null)

    if (selectedMethod === 'totp') {
      setLoading(true)
      try {
        const multiFactorUser = multiFactor(user)
        const session = await multiFactorUser.getSession()
        const secret = await TotpMultiFactorGenerator.generateSecret(session)
        setTotpSecret(secret)
        // Generate QR code URI for authenticator apps
        const accountName = user.email || 'Vigil User'
        const uri = secret.generateQrCodeUrl(accountName, 'Vigil Threat Intelligence')
        setTotpUri(uri)
        setStep('totp-setup')
      } catch (err) {
        console.error('Error generating TOTP secret:', err)
        setError(err.message || 'Failed to generate authenticator secret')
      }
      setLoading(false)
    } else {
      setStep('phone')
    }
  }

  async function handleSendCode(e) {
    e.preventDefault()
    if (!phoneNumber.trim()) return

    setLoading(true)
    setError(null)

    try {
      const auth = getAuth()

      // Create recaptcha verifier
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        })
      }

      const multiFactorUser = multiFactor(user)
      const session = await multiFactorUser.getSession()

      const phoneInfoOptions = {
        phoneNumber: phoneNumber.trim(),
        session,
      }

      const phoneAuthProvider = new PhoneAuthProvider(auth)
      const verId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        window.recaptchaVerifier
      )

      setVerificationId(verId)
      setStep('phone-verify')
    } catch (err) {
      console.error('Error sending verification code:', err)
      setError(err.message || 'Failed to send verification code')
    }

    setLoading(false)
  }

  async function handleVerifyPhoneCode(e) {
    e.preventDefault()
    if (!verificationCode.trim() || !verificationId) return

    setLoading(true)
    setError(null)

    try {
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode.trim())
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred)

      const multiFactorUser = multiFactor(user)
      await multiFactorUser.enroll(multiFactorAssertion, 'Phone')

      onSuccess()
    } catch (err) {
      console.error('Error verifying code:', err)
      setError(err.message || 'Failed to verify code')
    }

    setLoading(false)
  }

  async function handleVerifyTotpCode(e) {
    e.preventDefault()
    if (!verificationCode.trim() || !totpSecret) return

    setLoading(true)
    setError(null)

    try {
      const multiFactorAssertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        verificationCode.trim()
      )

      const multiFactorUser = multiFactor(user)
      await multiFactorUser.enroll(multiFactorAssertion, 'Authenticator App')

      onSuccess()
    } catch (err) {
      console.error('Error verifying TOTP code:', err)
      setError(err.message || 'Invalid code. Please try again.')
    }

    setLoading(false)
  }

  function resetToSelect() {
    setStep('select')
    setMethod(null)
    setPhoneNumber('')
    setVerificationCode('')
    setVerificationId(null)
    setTotpSecret(null)
    setTotpUri('')
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="cyber-card w-full max-w-md mx-4">
        {/* Method Selection */}
        {step === 'select' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Choose 2FA Method</h3>
            <p className="text-gray-400 text-sm mb-4">
              Select how you want to receive verification codes.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleSelectMethod('totp')}
                disabled={loading}
                className="w-full p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-cyber-accent rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-cyber-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <div>
                    <div className="text-white font-medium">Authenticator App</div>
                    <div className="text-gray-400 text-sm">
                      Use Google Authenticator, Authy, or similar apps
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-green-400">Recommended - Most secure</div>
              </button>

              <button
                onClick={() => handleSelectMethod('phone')}
                disabled={loading}
                className="w-full p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <div className="text-white font-medium">SMS Text Message</div>
                    <div className="text-gray-400 text-sm">
                      Receive codes via text message to your phone
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

            <div className="flex gap-3 pt-4 mt-4 border-t border-gray-800">
              <button type="button" onClick={onClose} className="cyber-button flex-1">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* TOTP Setup */}
        {step === 'totp-setup' && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">Set Up Authenticator App</h3>

            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Scan this QR code with your authenticator app, or enter the secret key manually.
              </p>

              {/* QR Code placeholder - use a QR library in production */}
              <div className="flex flex-col items-center p-4 bg-white rounded-lg">
                {totpUri ? (
                  <div className="text-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`}
                      alt="TOTP QR Code"
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500">Loading...</span>
                  </div>
                )}
              </div>

              {totpSecret && (
                <div className="p-3 bg-gray-800 rounded-lg">
                  <p className="text-gray-400 text-xs mb-1">Secret Key (enter manually):</p>
                  <code className="text-cyber-accent text-sm font-mono break-all select-all">
                    {totpSecret.secretKey}
                  </code>
                </div>
              )}

              <button
                onClick={() => setStep('totp-verify')}
                className="cyber-button-primary w-full"
              >
                Continue
              </button>

              <button type="button" onClick={resetToSelect} className="cyber-button w-full">
                Back
              </button>
            </div>
          </>
        )}

        {/* TOTP Verification */}
        {step === 'totp-verify' && (
          <form onSubmit={handleVerifyTotpCode} className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Verify Authenticator</h3>

            <p className="text-gray-400 text-sm">
              Enter the 6-digit code from your authenticator app to verify setup.
            </p>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Verification Code</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="cyber-input w-full text-center text-lg tracking-widest"
                placeholder="000000"
                maxLength={6}
                autoFocus
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('totp-setup')
                  setVerificationCode('')
                  setError(null)
                }}
                className="cyber-button flex-1"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="cyber-button-primary flex-1"
              >
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </form>
        )}

        {/* Phone Number Entry */}
        {step === 'phone' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Enable 2FA - Enter Phone Number
            </h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="cyber-input w-full"
                placeholder="+1 234 567 8900"
                required
              />
              <p className="text-gray-500 text-xs mt-1">Include country code (e.g., +1 for US)</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={resetToSelect} className="cyber-button flex-1">
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !phoneNumber.trim()}
                className="cyber-button-primary flex-1"
              >
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </div>
          </form>
        )}

        {/* Phone Code Verification */}
        {step === 'phone-verify' && (
          <form onSubmit={handleVerifyPhoneCode} className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Enter Verification Code</h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Verification Code</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="cyber-input w-full text-center text-lg tracking-widest"
                placeholder="123456"
                maxLength={6}
                required
              />
              <p className="text-gray-500 text-xs mt-1">
                Enter the 6-digit code sent to {phoneNumber}
              </p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('phone')
                  setVerificationCode('')
                  setError(null)
                }}
                className="cyber-button flex-1"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="cyber-button-primary flex-1"
              >
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </form>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  )
}
