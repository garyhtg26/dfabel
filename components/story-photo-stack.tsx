"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import "./story-photo-stack.css";

const photos = [
  {
    src: "/unsplash/people.jpg",
    alt: "Aktivitas mencuci di tempat laundry",
    label: "Di balik setiap cucian",
  },
  {
    src: "/unsplash/basket-web.webp",
    alt: "Pakaian bersih terlipat di laundry",
    label: "Bersih dan rapi",
  },
  {
    src: "/unsplash/warm.jpg",
    alt: "Proses menyetrika pakaian",
    label: "Dirawat dengan teliti",
  },
];

export default function StoryPhotoStack() {
  const [active, setActive] = useState(0);
  return (
    <div className="story-photos">
      <div
        className="story-photos-canvas"
        role="group"
        aria-label="Foto kegiatan laundry"
      >
        {photos.map((photo, index) => {
          const position = (index - active + photos.length) % photos.length;
          return (
            <button
              key={photo.src}
              type="button"
              className={`story-photo story-photo-${position}`}
              onClick={() =>
                setActive(
                  index === active ? (active + 1) % photos.length : index,
                )
              }
              aria-label={
                index === active
                  ? `Foto ${index + 1} dari ${photos.length}: ${photo.alt}. Lihat foto berikutnya`
                  : `Lihat foto ${index + 1}: ${photo.alt}`
              }
            >
              <span className="story-photo-image">
                <Image
                  src={photo.src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 60vw, 290px"
                  className="object-cover"
                />
              </span>
              <span className="story-photo-caption">
                {photo.label}
                <ArrowRight size={17} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
      <p className="story-photo-hint">
        Ketuk foto untuk melihat lainnya <span aria-hidden="true">·</span>{" "}
        {String(active + 1).padStart(2, "0")} / 03
      </p>
    </div>
  );
}
