import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { SiteFooter } from "./components/SiteFooter";
import { InternalInformationCollectionPage } from "./pages/InternalInformationCollectionPage";
import { OpsHomePage } from "./pages/OpsHomePage";
import { publicUrl } from "./publicUrl";

const markSrc = publicUrl("brand/studytour-mark.svg");

export function App() {
  return (
    <BrowserRouter>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="site-brand site-brand-link site-brand-with-mark">
            <img className="site-logo" src={markSrc} width={40} height={40} alt="StudyTour Ops" decoding="async" />
            <span className="site-brand-text">StudyTour Ops</span>
          </Link>
          <nav className="site-nav">
            <Link to="/">Home</Link>
          </nav>
        </div>
      </header>

      <div className="site-main-wrap">
        <Routes>
          <Route path="/" element={<OpsHomePage />} />
          <Route
            path="/projects/:projectId/modules/internal-information-collection"
            element={<InternalInformationCollectionPage />}
          />
          <Route path="/modules/internal-information-collection" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <SiteFooter />
    </BrowserRouter>
  );
}
