import { ContactForm } from "@/components/sections/ContactForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Begin your bespoke commission. Contact Mundi Collesi to discuss your vision for hand-painted wallpaper and interior artistry.",
};

export default function ContactPage() {
  return <ContactForm />;
}
