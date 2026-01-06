"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface FeatureProps {
  title: string;
  description: string;
  imageUrl: string;
  reversed?: boolean;
}

const Feature = ({ title, description, imageUrl, reversed = false }: FeatureProps) => {
  return (
    <div className={`flex flex-col md:flex-row items-center gap-12 md:gap-24 py-24 ${reversed ? 'md:flex-row-reverse' : ''}`}>
      <motion.div 
        initial={{ opacity: 0, x: reversed ? 50 : -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true, margin: "-100px" }}
        className="flex-1 w-full"
      >
        <div className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden rounded-sm shadow-2xl">
          <Image 
            src={imageUrl} 
            alt={title} 
            fill 
            className="object-cover hover:scale-105 transition-transform duration-700" 
          />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        viewport={{ once: true }}
        className="flex-1 space-y-6 text-center md:text-left px-6 md:px-0"
      >
        <h2 className="text-3xl md:text-5xl font-serif text-gray-900">{title}</h2>
        <div className="w-12 h-1 bg-gray-900 mx-auto md:mx-0" />
        <p className="text-gray-600 leading-relaxed text-lg font-light">
          {description}
        </p>
      </motion.div>
    </div>
  );
};

export function FeatureSection() {
  return (
    <section className="container mx-auto px-6 py-24 bg-white">
      <Feature 
        title="Flora & livings"
        description="We strip nature back to its essential forms. By flattening the perspective and emphasizing the silhouette, we create botanical patterns that feel architectural rather than merely decorative."
        imageUrl="https://hozn2hsy91dhisxu.public.blob.vercel-storage.com/Wallpaper_hand%20painted_closeup.JPG"
      />
      <Feature 
        title="Immersive Atmosphere"
        description="A Mundi Collesi wall is not a picture; it is an environment. Our designs are created to wrap around a room, creating a seamless, dream-like space where color and form dictate the mood."
        imageUrl="https://hozn2hsy91dhisxu.public.blob.vercel-storage.com/flora-hand-painted-on-silk-wallpaper-immersive-space.JPG"
        reversed
      />
      {/* Temporarily hidden - may bring back in the future */}
      {/* <Feature 
        title="The Fabric of Luxury"
        description="We paint exclusively on premium silk fabric with pearlescent and iridescent finishes. The texture of our base materials adds a dimension of tactile luxury that interacts with our bold, graphic paint applications, creating surfaces that transform with light."
        imageUrl="https://hozn2hsy91dhisxu.public.blob.vercel-storage.com/close-up-details-on-premium-luxury-silk-canvas.JPG"
      /> */}
    </section>
  );
}
