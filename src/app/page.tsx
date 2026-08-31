'use client'

import Link from 'next/link'
import { Show } from '@/components/clerk-shim'
import { useLanguage } from '@/lib/i18n/language-context'

export default function Home() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background text-on-surface overflow-x-hidden">
      {/* Navigation Shell */}
      <nav className="fixed top-0 w-full z-50 glass-panel-strong border-b border-white/50">
        <div className="flex justify-between items-center px-5 md:px-16 py-4 max-w-[1440px] mx-auto">
          <div className="text-xl font-bold text-deep-navy tracking-tight">
            CareDesk
          </div>
          <div className="hidden md:flex space-x-8 text-[16px]">
            <a className="text-on-surface-variant hover:text-secondary transition-colors px-3 py-2 rounded-lg" href="#features">
              Features
            </a>
            <a className="text-on-surface-variant hover:text-secondary transition-colors px-3 py-2 rounded-lg" href="#how-it-works">
              How It Works
            </a>
            <a className="text-on-surface-variant hover:text-secondary transition-colors px-3 py-2 rounded-lg" href="#trust">
              Testimonials
            </a>
          </div>
          <div>
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="btn-primary-gradient px-6 py-2 rounded-full font-bold text-[14px] active:scale-95 transition-transform duration-200"
              >
                Get Started
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="btn-primary-gradient px-6 py-2 rounded-full font-bold text-[14px] active:scale-95 transition-transform duration-200"
              >
                Dashboard
              </Link>
            </Show>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-[120px] pb-20 px-5 md:px-16 max-w-[1440px] mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[70vh]">
            {/* Hero Text */}
            <div className="flex flex-col items-start z-10">
              <div className="inline-block px-4 py-1.5 rounded-full glass-panel border-electric-blue/30 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-electric-blue text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>vital_signs</span>
                <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-deep-navy">Introducing Next-Gen AI</span>
              </div>
              <h1 className="text-[30px] leading-[38px] md:text-[40px] md:leading-[52px] font-bold text-deep-navy mb-6 tracking-tight">
                Health Intelligence,<br />
                <span className="gradient-text">Simplified.</span>
              </h1>
              <p className="text-[18px] leading-[30px] text-on-surface-variant mb-10 max-w-lg">
                Turn complex medical reports into clear, actionable insights for you, your family, and your doctor. Experience clarity with our premium dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Show when="signed-out">
                  <Link href="/sign-up" className="btn-primary-gradient text-[16px] px-8 py-3.5 rounded-full font-bold flex justify-center items-center gap-2">
                    Start Free Trial
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link href="/dashboard" className="btn-primary-gradient text-[16px] px-8 py-3.5 rounded-full font-bold flex justify-center items-center gap-2">
                    Go to Dashboard
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Link>
                </Show>
                <button className="btn-glass text-[16px] px-8 py-3.5 rounded-full font-bold flex justify-center items-center gap-2">
                  View Demo
                  <span className="material-symbols-outlined text-electric-blue">play_circle</span>
                </button>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative w-full h-[400px] lg:h-[500px] mt-12 lg:mt-0 z-0">
              <div className="absolute inset-0 bg-gradient-to-tr from-surface-container-highest to-surface-container rounded-[3rem] transform rotate-3 opacity-50 blur-xl"></div>
              <div className="relative w-full h-full glass-panel organic-radius overflow-hidden border border-white flex items-center justify-center">
                {/* Abstract dashboard illustration */}
                <div className="absolute inset-8 grid grid-cols-3 grid-rows-3 gap-3 opacity-60">
                  <div className="col-span-2 glass-panel rounded-xl p-4">
                    <div className="w-full h-3 bg-surface-container-highest rounded-full mb-2"></div>
                    <div className="w-3/4 h-3 bg-surface-container-highest/60 rounded-full mb-4"></div>
                    <div className="flex gap-2 h-16">
                      <div className="flex-1 bg-gradient-to-t from-secondary/30 to-transparent rounded"></div>
                      <div className="flex-1 bg-gradient-to-t from-electric-blue/30 to-transparent rounded"></div>
                      <div className="flex-1 bg-gradient-to-t from-secondary/20 to-transparent rounded"></div>
                      <div className="flex-1 bg-gradient-to-t from-electric-blue/40 to-transparent rounded"></div>
                      <div className="flex-1 bg-gradient-to-t from-secondary/30 to-transparent rounded"></div>
                    </div>
                  </div>
                  <div className="glass-panel rounded-xl p-3 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center mb-2">
                      <span className="material-symbols-outlined text-secondary text-lg">neurology</span>
                    </div>
                    <div className="w-12 h-2 bg-surface-container-highest rounded-full"></div>
                  </div>
                  <div className="glass-panel rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-electric-blue/20 flex items-center justify-center mb-2">
                      <span className="material-symbols-outlined text-electric-blue text-sm">favorite</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-highest rounded-full mb-1"></div>
                    <div className="w-2/3 h-2 bg-surface-container-highest/60 rounded-full"></div>
                  </div>
                  <div className="col-span-2 glass-panel rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-secondary/20"></div>
                      <div className="w-20 h-2 bg-surface-container-highest rounded-full"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-20 bg-gradient-to-t from-secondary/10 to-transparent rounded"></div>
                      <div className="flex-1 h-20 bg-gradient-to-t from-electric-blue/15 to-transparent rounded"></div>
                      <div className="flex-1 h-20 bg-gradient-to-t from-secondary/10 to-transparent rounded"></div>
                    </div>
                  </div>
                </div>
                {/* Floating Analysis Card */}
                <div className="absolute bottom-8 left-8 right-8 glass-panel rounded-xl p-4 flex items-center gap-4 border border-white/40">
                  <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>neurology</span>
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold text-deep-navy">Analysis Complete</p>
                    <p className="text-[14px] text-on-surface-variant">3 key insights found in latest report.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-5 md:px-16 max-w-[1440px] mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-[28px] leading-[36px] font-semibold text-deep-navy mb-4">Intelligence at Every Level</h2>
            <p className="text-[18px] leading-[28px] text-on-surface-variant">Designed to bring clarity to medical data, whether you are managing family health or reviewing clinical histories.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass-panel organic-radius p-8 flex flex-col items-start transition-transform hover:-translate-y-2 duration-300">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-surface-container to-surface-container-highest flex items-center justify-center mb-6 shadow-sm border border-white/50">
                <span className="material-symbols-outlined text-secondary text-3xl">document_scanner</span>
              </div>
              <h3 className="text-[18px] font-semibold text-deep-navy mb-3">AI Report Analysis</h3>
              <p className="text-[14px] leading-[22px] text-on-surface-variant flex-grow">
                Instantly translate dense medical jargon into plain, understandable language. Our AI highlights critical values and explains what they mean for your daily life.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="glass-panel organic-radius p-8 flex flex-col items-start transition-transform hover:-translate-y-2 duration-300 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-electric-blue/10 rounded-full blur-2xl"></div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-surface-container to-surface-container-highest flex items-center justify-center mb-6 shadow-sm border border-white/50 relative z-10">
                <span className="material-symbols-outlined text-electric-blue text-3xl">family_history</span>
              </div>
              <h3 className="text-[18px] font-semibold text-deep-navy mb-3 relative z-10">Family Proactive Alerts</h3>
              <p className="text-[14px] leading-[22px] text-on-surface-variant flex-grow relative z-10">
                Keep your entire family&apos;s health on track. Receive smart, predictive alerts for upcoming screenings, medication interactions, and wellness milestones.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="glass-panel organic-radius p-8 flex flex-col items-start transition-transform hover:-translate-y-2 duration-300">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-surface-container to-surface-container-highest flex items-center justify-center mb-6 shadow-sm border border-white/50">
                <span className="material-symbols-outlined text-deep-navy text-3xl">stethoscope</span>
              </div>
              <h3 className="text-[18px] font-semibold text-deep-navy mb-3">Clinical Summaries for Doctors</h3>
              <p className="text-[14px] leading-[22px] text-on-surface-variant flex-grow">
                Generate secure, formatted overviews of your health timeline designed specifically for physicians, ensuring your next appointment is focused and efficient.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 px-5 md:px-16 bg-surface-container-low/50">
          <div className="max-w-[1440px] mx-auto">
            <h2 className="text-[28px] leading-[36px] font-semibold text-deep-navy text-center mb-16">How CareDesk Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-outline-variant/30 to-transparent z-0"></div>
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-24 h-24 rounded-full glass-panel flex items-center justify-center border-2 border-surface-container-highest mb-6 shadow-sm">
                  <span className="text-[28px] font-semibold text-secondary">1</span>
                </div>
                <h3 className="text-[18px] font-semibold text-deep-navy mb-2">Upload</h3>
                <p className="text-[14px] leading-[22px] text-on-surface-variant max-w-xs">Securely snap a photo or upload PDFs of your lab results and medical records.</p>
              </div>
              {/* Step 2 */}
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-24 h-24 rounded-full glass-panel flex items-center justify-center border-2 border-electric-blue mb-6 shadow-sm relative">
                  <div className="absolute inset-0 rounded-full border border-electric-blue animate-ping opacity-20"></div>
                  <span className="text-[28px] font-semibold text-electric-blue">2</span>
                </div>
                <h3 className="text-[18px] font-semibold text-deep-navy mb-2">Analyze</h3>
                <p className="text-[14px] leading-[22px] text-on-surface-variant max-w-xs">Our medical AI instantly processes the data, cross-referencing global clinical guidelines.</p>
              </div>
              {/* Step 3 */}
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-24 h-24 rounded-full glass-panel flex items-center justify-center border-2 border-surface-container-highest mb-6 shadow-sm">
                  <span className="text-[28px] font-semibold text-secondary">3</span>
                </div>
                <h3 className="text-[18px] font-semibold text-deep-navy mb-2">Act</h3>
                <p className="text-[14px] leading-[22px] text-on-surface-variant max-w-xs">Review simplified insights, share summaries with your care team, and make informed decisions.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust / Testimonial */}
        <section id="trust" className="py-20 px-5 md:px-16 max-w-[1440px] mx-auto flex justify-center">
          <div className="glass-panel organic-radius max-w-4xl p-10 md:p-16 flex flex-col md:flex-row items-center gap-10">
            <div className="w-32 h-32 shrink-0 rounded-full overflow-hidden border-4 border-surface-container-lowest shadow-sm bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-5xl">person</span>
            </div>
            <div className="flex-grow text-center md:text-left">
              <span className="material-symbols-outlined text-surface-container-highest text-5xl mb-4 opacity-50" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
              <p className="text-[18px] leading-[28px] text-deep-navy italic mb-6">
                &quot;CareDesk bridges the critical gap between raw clinical data and patient comprehension. When my patients use it, they come to appointments informed and ready to discuss care plans.&quot;
              </p>
              <div>
                <h4 className="text-[18px] font-semibold text-deep-navy">Dr. Sarah Jenkins, MD</h4>
                <p className="text-[14px] text-on-surface-variant">Chief of Internal Medicine, Horizon Health</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full mt-20 bg-deep-navy text-white grid grid-cols-1 md:grid-cols-2 gap-8 px-5 md:px-16 py-12 max-w-[1440px] mx-auto">
          <div className="flex flex-col gap-4">
            <div className="text-[18px] font-bold text-white">CareDesk</div>
            <p className="text-surface-dim/70 text-[14px]">© 2025 CareDesk AI. Intelligence for a healthier future.</p>
          </div>
          <div className="flex flex-wrap gap-6 md:justify-end items-start mt-4 md:mt-0">
            <a className="text-surface-dim/70 hover:text-white hover:underline transition-all text-[14px]" href="/privacy">Privacy Policy</a>
            <a className="text-surface-dim/70 hover:text-white hover:underline transition-all text-[14px]" href="#">Terms of Service</a>
            <a className="text-surface-dim/70 hover:text-white hover:underline transition-all text-[14px]" href="#">Contact Support</a>
          </div>
        </footer>
      </main>
    </div>
  )
}
