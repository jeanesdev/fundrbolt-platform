/**
 * UnderConstructionPage - shown for routes that don't have pages yet.
 */

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import './UnderConstructionPage.css';

export const UnderConstructionPage = () => {
  return (
    <>
      <Helmet>
        <title>Coming Soon - FundrBolt Platform</title>
        <meta name="description" content="This page is under construction. Check back soon!" />
      </Helmet>

      <section className="under-construction">
        <div className="container">
          <div className="under-construction-content">
            <div className="under-construction-icon" aria-hidden="true">🚧</div>
            <h1 className="under-construction-title">Under Construction</h1>
            <p className="under-construction-message">
              We're working on this page. Check back soon!
            </p>
            <Link to="/" className="btn btn-primary">
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};
