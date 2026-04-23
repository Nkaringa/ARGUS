import { Outlet } from 'react-router-dom';
import { ReactLenis } from 'lenis/react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ScrollToTop } from './components/layout/ScrollToTop';

function App() {
  return (
    <ReactLenis root>
      <div className="min-h-screen flex flex-col bg-background selection:bg-accent/20">
        <ScrollToTop />
        <Navbar />
        <main className="flex-grow">
          <Outlet />
        </main>
        <Footer />
      </div>
    </ReactLenis>
  );
}

export default App;
