import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-white py-16">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <h3 className="text-2xl font-serif tracking-widest">MUNDI COLLESI</h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Exquisite hand-painted wallpapers for the discerning few. 
              Elevating interiors through post-modern naturalism and bespoke artistry.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-6">Explore</h4>
            <ul className="space-y-4 text-sm text-neutral-400">
              {/* <li><Link href="/collections" className="hover:text-white transition-colors">Collections</Link></li> */}
              <li><Link href="/philosophy" className="hover:text-white transition-colors">Our Philosophy</Link></li>
              <li><Link href="/journal" className="hover:text-white transition-colors">Journal</Link></li>
              <li><Link href="/materials" className="hover:text-white transition-colors">Materials</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-6">Legal</h4>
            <ul className="space-y-4 text-sm text-neutral-400">
              <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-6">Connect</h4>
            <p className="text-sm text-neutral-400 mb-4">
              Join our newsletter for exclusive previews.
            </p>
            {/* Newsletter placeholder */}
            <div className="flex border-b border-neutral-700 pb-2">
              <input 
                type="email" 
                placeholder="Your email" 
                className="bg-transparent border-none outline-none w-full text-sm placeholder-neutral-600"
              />
              <button className="text-xs uppercase tracking-widest hover:text-gray-300">Join</button>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-neutral-500">
          <p>&copy; {new Date().getFullYear()} Mundi Collesi. All rights reserved.</p>
          <p>Designed with elegance in New Zealand.</p>
        </div>
      </div>
    </footer>
  );
}
