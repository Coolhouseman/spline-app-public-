"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const heroImage = "https://hozn2hsy91dhisxu.public.blob.vercel-storage.com/living-room-fruits-and-floral-painting-on-dark-blue-silk.jpg";

export function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div ref={ref} className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-stone-100">
      {/* Background Image */}
      <motion.div 
        style={{ y, opacity }}
        className="absolute inset-0 z-0"
      >
        <div className="absolute inset-0 bg-black/20 z-10" />
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{
            backgroundImage: `url('${heroImage}')`,
          }}
        />
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="relative z-20 text-center text-white p-4"
      >
        <h1 className="text-5xl md:text-7xl lg:text-9xl font-serif font-bold tracking-tighter mb-4 mix-blend-overlay">
          MUNDI COLLESI
        </h1>
        <p className="text-lg md:text-2xl font-light tracking-[0.2em] uppercase mix-blend-overlay">
          The Art of Living
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white z-20 flex flex-col items-center gap-2"
      >
        <span className="text-xs uppercase tracking-widest">Scroll</span>
        <div className="w-px h-12 bg-white/50" />
      </motion.div>
    </div>
  );
}

