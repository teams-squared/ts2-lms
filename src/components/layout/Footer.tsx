export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <p className="text-xs text-gray-400 text-center sm:text-right">
          &copy; {new Date().getFullYear()} Teams Squared. Internal use only.
        </p>
      </div>
    </footer>
  );
}
