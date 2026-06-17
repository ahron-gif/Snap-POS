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
              width={180}
              height="auto"
              src="/images/logo/snap-logo.png"
              alt="Snap POS Logo"
              className="mb-2"
            />
          </Link>
        </div>
        {children}
        <div className="items-center hidden w-full h-full lg:w-1/2 bg-gray-50 dark:bg-white/5 lg:grid">
          <div className="relative flex items-center justify-center z-1">
            <GridShape />
            <div className="flex flex-col items-center max-w-sm">
              <Link to="/" className="block mb-6 flex items-center justify-center">
                <img
                  width={220}
                  height="auto"
                  src="/images/logo/snap-logo.png"
                  alt="Snap POS Logo"
                />
              </Link>
              <p className="text-center text-gray-600 dark:text-white/60 text-lg">
               Empowering businesses with seamless, efficient, and scalable POS solutions
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