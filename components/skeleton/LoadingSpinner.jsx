'use client';

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function LoadingSpinner() {
  const [isVisible, setIsVisible] = useState(true);

  // Optional: Auto-hide after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000); // 5 seconds timeout
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ 
          duration: 0.5,
          ease: [0.17, 0.67, 0.83, 0.67] // Custom ease-in-out curve
        }}
        className="flex flex-col items-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ 
            repeat: Infinity, 
            ease: "easeInOut",
            duration: 2 
          }}
          className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-200 border-t-amber-500 bg-white shadow-sm"
        >
          <span className="text-lg font-semibold text-slate-700">ERP</span>
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ 
            delay: 0.3,
            ease: "easeInOut",
            duration: 0.5
          }}
          className="text-sm text-muted-foreground"
        >
          Loading, please wait...
        </motion.p>
      </motion.div>
    </div>
  );
}
