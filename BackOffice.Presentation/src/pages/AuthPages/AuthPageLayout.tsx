import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: `url('/images/auth/bg-main.png') center center / cover no-repeat fixed`,
        backgroundColor: '#f0f4f0',
      }}
    >
      {/* Subtle overlay for readability */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.3) 0%, rgba(240,244,240,0.5) 100%)',
        }}
      />

      {/* Login Card */}
      <div
        className="relative z-10 w-full max-w-[420px] animate-fade-in-up"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          borderRadius: '24px',
          padding: '48px 40px',
          boxShadow: '0 32px 64px rgba(0, 0, 0, 0.08), 0 16px 32px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(46, 204, 113, 0.05)',
        }}
      >
        {/* Logo Section */}
        <div className="text-center mb-8">
          <img
            src="/images/logo/snap-icon-green-circle.png"
            alt="Snap"
            className="w-14 h-14 rounded-full mx-auto mb-3"
          />
          <div
            className="text-[28px] font-bold text-[#1A1A2E] tracking-tight"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            snap
          </div>
          <div
            className="text-[11px] font-medium text-[#95A5A6] tracking-[3px] uppercase mt-0.5"
          >
            POINT OF SALE
          </div>
        </div>

        {/* Form Content */}
        {children}
      </div>
    </div>
  );
}
