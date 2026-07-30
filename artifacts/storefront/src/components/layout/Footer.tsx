import React from 'react';
import { Link } from 'wouter';

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground mt-auto">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold text-xl tracking-tighter">
                H
              </div>
              <span className="font-extrabold text-xl tracking-tight">Happyfine</span>
            </Link>
            <p className="text-secondary-foreground/80 text-sm max-w-xs leading-relaxed">
              Premium wholesale and retail platform based in Kenya. Delivering quality goods at commercial scale.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider text-sm text-primary">Shop</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/80">
              <li><Link href="/products?category=home" className="hover:text-white transition-colors">Home & Living</Link></li>
              <li><Link href="/products?category=electronics" className="hover:text-white transition-colors">Electronics</Link></li>
              <li><Link href="/products?category=fashion" className="hover:text-white transition-colors">Fashion</Link></li>
              <li><Link href="/products?category=beauty" className="hover:text-white transition-colors">Beauty</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider text-sm text-primary">Support</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/80">
              <li><Link href="/account" className="hover:text-white transition-colors">Track Order</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQs</Link></li>
              <li><Link href="/returns" className="hover:text-white transition-colors">Returns & Exchanges</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider text-sm text-primary">Contact</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/80">
              <li>Nairobi, Kenya</li>
              <li>+254 700 000 000</li>
              <li>support@happyfine.co.ke</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-secondary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-secondary-foreground/60">
          <p>© {new Date().getFullYear()} Happyfine Wholesalers. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-white cursor-pointer">Terms</span>
            <span className="hover:text-white cursor-pointer">Privacy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
