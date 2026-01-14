/**
 * Onboarding Tour Component
 * Guides new users through key features of Vigil
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Vigil',
    description: 'Your cyber threat intelligence command center. Let\'s take a quick tour of the key features.',
    target: null,
    position: 'center',
    route: '/',
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Your home base shows real-time threat statistics, trending actors, and recent incidents at a glance.',
    target: '[data-tour="dashboard-stats"]',
    position: 'bottom',
    route: '/',
  },
  {
    id: 'events',
    title: 'Unified Events',
    description: 'All security events from ransomware, vulnerabilities, IOCs, and alerts in one timeline.',
    target: '[data-tour="nav-events"]',
    position: 'right',
    route: '/events',
  },
  {
    id: 'actors',
    title: 'Threat Actors',
    description: 'Track ransomware groups and APTs. See their activity trends, targets, and TTPs.',
    target: '[data-tour="nav-actors"]',
    position: 'right',
    route: '/actors',
  },
  {
    id: 'search',
    title: 'Quick Search',
    description: 'Press Cmd+K (or Ctrl+K) anytime to search across actors, incidents, CVEs, and IOCs.',
    target: '[data-tour="search-button"]',
    position: 'bottom',
    route: '/actors',
  },
  {
    id: 'watchlist',
    title: 'Watchlists',
    description: 'Track specific actors, CVEs, or IOCs that matter to your organization.',
    target: '[data-tour="nav-watchlists"]',
    position: 'right',
    route: '/watchlists',
  },
  {
    id: 'settings',
    title: 'Personalize Your Feed',
    description: 'Set up your industry and tech stack (like Cisco, Microsoft) to get alerts tailored to YOUR organization.',
    target: '[data-tour="nav-settings"]',
    position: 'right',
    route: '/settings',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Head to Settings to personalize your feed. Get Cisco zero-days, healthcare incidents, or whatever matters to you - before it hits the news.',
    target: null,
    position: 'center',
    route: '/settings',
  },
]

function TourTooltip({ step, onNext, onPrev, onSkip, currentIndex, totalSteps }) {
  const [position, setPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })

  useEffect(() => {
    if (step.target) {
      const element = document.querySelector(step.target)
      if (element) {
        const rect = element.getBoundingClientRect()
        const pos = calculatePosition(rect, step.position)
        setPosition(pos)

        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })

        // Add highlight
        element.classList.add('tour-highlight')
        return () => element.classList.remove('tour-highlight')
      }
    }
    // Center position for steps without target
    setPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
  }, [step])

  function calculatePosition(rect, position) {
    const padding = 16

    switch (position) {
      case 'bottom':
        return {
          top: `${rect.bottom + padding}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)',
        }
      case 'top':
        return {
          top: `${rect.top - padding}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        }
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + padding}px`,
          transform: 'translateY(-50%)',
        }
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.left - padding}px`,
          transform: 'translate(-100%, -50%)',
        }
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
  }

  const isFirst = currentIndex === 0
  const isLast = currentIndex === totalSteps - 1

  return (
    <div
      className="fixed z-[9999] w-80 bg-gray-900 border border-cyan-500/50 rounded-xl shadow-2xl shadow-cyan-500/20"
      style={position}
    >
      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-t-xl overflow-hidden">
        <div
          className="h-full bg-cyan-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>

      <div className="p-5">
        <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
        <p className="text-gray-400 text-sm mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            Skip tour
          </button>

          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white"
              >
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? 'bg-cyan-500' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function OnboardingTour({ onComplete }) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Check if user has completed the tour
    const hasCompletedTour = localStorage.getItem('vigil_tour_completed')
    if (!hasCompletedTour) {
      // Small delay to let the page render
      setTimeout(() => setIsActive(true), 1000)
    }
  }, [])

  useEffect(() => {
    // Navigate to the correct route for the current step
    if (isActive) {
      const step = TOUR_STEPS[currentStep]
      if (step.route && location.pathname !== step.route) {
        navigate(step.route)
      }
    }
  }, [currentStep, isActive])

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTour()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    completeTour()
  }

  const completeTour = () => {
    localStorage.setItem('vigil_tour_completed', 'true')
    setIsActive(false)
    onComplete?.()
  }

  if (!isActive) return null

  const step = TOUR_STEPS[currentStep]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-[9998]" onClick={handleSkip} />

      {/* Tooltip */}
      <TourTooltip
        step={step}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        currentIndex={currentStep}
        totalSteps={TOUR_STEPS.length}
      />

      {/* Styles for highlighted elements */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 9999;
          box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.4), 0 0 20px rgba(34, 211, 238, 0.3);
          border-radius: 8px;
        }
      `}</style>
    </>
  )
}

/**
 * Hook to manually trigger the tour
 */
export function useTour() {
  const resetTour = () => {
    localStorage.removeItem('vigil_tour_completed')
    window.location.reload()
  }

  const isTourCompleted = () => {
    return localStorage.getItem('vigil_tour_completed') === 'true'
  }

  return { resetTour, isTourCompleted }
}

/**
 * Button to restart the tour (for Settings page)
 */
export function RestartTourButton() {
  const { resetTour } = useTour()

  return (
    <button
      onClick={resetTour}
      className="text-sm text-cyan-400 hover:text-cyan-300"
    >
      Restart onboarding tour
    </button>
  )
}
