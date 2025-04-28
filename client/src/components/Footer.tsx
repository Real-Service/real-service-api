import { 
  FaTwitter, 
  FaFacebook, 
  FaInstagram 
} from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-[#040f2d]">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-blue-300 tracking-wider uppercase">
              About
            </h3>
            <ul className="mt-4 space-y-4">
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Company
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Press
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-300 tracking-wider uppercase">
              Resources
            </h3>
            <ul className="mt-4 space-y-4">
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Guides
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Blog
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-300 tracking-wider uppercase">
              Legal
            </h3>
            <ul className="mt-4 space-y-4">
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white">
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-300 tracking-wider uppercase">
              Connect
            </h3>
            <ul className="mt-4 space-y-4">
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white flex items-center">
                  <FaTwitter className="mr-2 text-blue-400" /> Twitter
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white flex items-center">
                  <FaFacebook className="mr-2 text-blue-400" /> Facebook
                </a>
              </li>
              <li>
                <a href="#" className="text-base text-blue-200 hover:text-white flex items-center">
                  <FaInstagram className="mr-2 text-blue-400" /> Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-blue-900 pt-8">
          <p className="text-base text-blue-300 text-center">
            &copy; {new Date().getFullYear()} FixMyRental, Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
