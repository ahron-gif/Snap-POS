import React from "react";
import GridShape from "../../components/common/GridShape";
import { Link } from "react-router";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {/* Mobile and Tablet Logo */}
        <div className="flex flex-col items-center justify-center p-4 lg:hidden">
          <Link to="/" className="flex flex-col items-center justify-center mb-4">
            <img
              width={140}
              height="auto"
              src="/images/logo/auth-logo.png"
              alt="RDT Logo"
              className="mb-2"
            />
            <p className="text-center text-gray-700 dark:text-gray-300 text-base sm:text-lg">
              inSight + inStinct + inCrease
            </p>
          </Link>
        </div>
        {children}
        <div className="items-center hidden w-full h-full lg:w-1/2 bg-brand-950 dark:bg-white/5 lg:grid">
          <div className="relative flex items-center justify-center z-1">
            <GridShape />
            <div className="flex flex-col items-center max-w-sm">
              <Link to="/" className="block mb-4 flex items-end justify-center">
                <img
                  width={140}
                  height="auto"
                  src="/images/logo/auth-logo.png"
                  alt="Logo"
                />
                <p className="text-end text-white ml-0">
                  inSight + inStinct + inCrease
                </p>
              </Link>
              <p className="text-center text-gray-400 dark:text-white/60">
               Empowering businesses with seamless, efficient, and scalable ERP solutions
              </p>
            </div>
          </div>
        </div>
        {/* <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div> */}
      </div>
    </div>
  );
}