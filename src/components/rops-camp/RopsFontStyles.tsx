"use client";

export function RopsFontStyles() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Manrope:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Manrope', system-ui, sans-serif; }
        .number-tag { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "ss01" 1; }

        .bg-rops-cream { background-color: #F4EEE3; }
        .bg-rops-cream-2 { background-color: #EDE5D5; }
        .bg-rops-ink { background-color: #16110D; }
        .bg-rops-ink-2 { background-color: #2A211A; }
        .bg-rops-ember { background-color: #D14A1F; }
        .bg-rops-forest { background-color: #1F3A2E; }

        .text-rops-cream { color: #F4EEE3; }
        .text-rops-cream\\/70 { color: rgba(244, 238, 227, 0.7); }
        .text-rops-ink { color: #16110D; }
        .text-rops-ink-2 { color: #2A211A; }
        .text-rops-ink\\/70 { color: rgba(22, 17, 13, 0.7); }
        .text-rops-ember { color: #D14A1F; }
        .text-rops-forest { color: #1F3A2E; }
        .text-rops-taupe { color: #968779; }

        .border-rops-line { border-color: #DCD2BE; }
        .border-rops-ink { border-color: #16110D; }
        .border-rops-ember { border-color: #D14A1F; }
        .border-rops-taupe { border-color: rgba(150, 135, 121, 1); }
        .border-rops-taupe\\/20 { border-color: rgba(150, 135, 121, 0.2); }
        .border-rops-taupe\\/40 { border-color: rgba(150, 135, 121, 0.4); }

        .hover\\:bg-rops-ember:hover { background-color: #D14A1F; }
        .hover\\:bg-rops-ember-2:hover { background-color: #B23E18; }
        .hover\\:bg-rops-cream:hover { background-color: #F4EEE3; }
        .hover\\:border-rops-ink:hover { border-color: #16110D; }
        .hover\\:border-rops-ember:hover { border-color: #D14A1F; }
        .hover\\:border-rops-cream:hover { border-color: #F4EEE3; }
        .hover\\:text-rops-cream:hover { color: #F4EEE3; }
        .hover\\:text-rops-ink:hover { color: #16110D; }
        .hover\\:text-rops-ember:hover { color: #D14A1F; }

        .group:hover .group-hover\\:border-rops-ink { border-color: #16110D; }

        .focus\\:border-rops-ember:focus { border-color: #D14A1F; }
        .focus\\:outline-none:focus { outline: none; }

        .placeholder\\:text-rops-taupe\\/60::placeholder { color: rgba(150, 135, 121, 0.6); }

        .bg-rops-cream\\/5 { background-color: rgba(244, 238, 227, 0.05); }
        .bg-rops-ember\\/5 { background-color: rgba(209, 74, 31, 0.05); }
        .border-rops-ember\\/30 { border-color: rgba(209, 74, 31, 0.3); }

        .text-rops-h1 {
          font-size: 2.75rem;
          line-height: 0.95;
          letter-spacing: -0.02em;
        }
        @media (min-width: 480px) { .text-rops-h1 { font-size: 3.5rem; } }
        @media (min-width: 640px) { .text-rops-h1 { font-size: 4.5rem; } }
        @media (min-width: 768px) { .text-rops-h1 { font-size: 5.5rem; line-height: 0.92; } }
        @media (min-width: 1024px) { .text-rops-h1 { font-size: 7rem; } }

        .ember-glow { box-shadow: 0 6px 30px -10px rgba(209,74,31,0.55); }
        .rops-grain {
          background-image: radial-gradient(rgba(22,17,13,0.045) 1px, transparent 1px);
          background-size: 3px 3px;
        }

        @keyframes risefade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rise { animation: risefade 700ms cubic-bezier(.2,.7,.2,1) both; }
        .rise-1 { animation-delay: 60ms; }
        .rise-2 { animation-delay: 140ms; }
        .rise-3 { animation-delay: 220ms; }
        .rise-4 { animation-delay: 300ms; }
        .rise-5 { animation-delay: 380ms; }

        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scaleY(1); }
          50% { opacity: 0.85; transform: scaleY(1.05); }
        }
        .flame-flicker {
          animation: flicker 2.4s ease-in-out infinite;
          transform-origin: center bottom;
        }

        .marquee-mask {
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }

        .grad-ink-30-up {
          background-image: linear-gradient(to top, rgba(22, 17, 13, 0.3) 0%, transparent 60%);
        }
        .grad-footer-up {
          background-image: linear-gradient(to top, #16110D 0%, rgba(22, 17, 13, 0.4) 60%, transparent 100%);
        }
      `}</style>
    </>
  );
}
