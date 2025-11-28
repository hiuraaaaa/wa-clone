export const metadata = {
  title: "Realtime WA Chat",
  description: "WhatsApp-like realtime chat with Supabase"
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
