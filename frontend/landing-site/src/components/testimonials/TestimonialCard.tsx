/**
 * TestimonialCard component displays a single testimonial.
 */

import './TestimonialCard.css';

export interface TestimonialCardProps {
  quote_text: string;
  author_name: string;
  author_role: 'donor' | 'auctioneer' | 'npo_admin';
  organization_name: string | null;
  photo_url: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  donor: 'Donor',
  auctioneer: 'Auctioneer',
  npo_admin: 'NPO Administrator',
};

export const TestimonialCard = ({
  quote_text,
  author_name,
  author_role,
  organization_name,
  photo_url,
}: TestimonialCardProps) => {
  return (
    <article className="testimonial-card">
      <div className="testimonial-quote">
        <span className="quote-icon" aria-hidden="true">"</span>
        <p>{quote_text}</p>
      </div>

      <div className="testimonial-author">
        {photo_url && (
          <img
            src={photo_url}
            alt={`${author_name} profile`}
            className="author-photo"
          />
        )}
        {!photo_url && (
          <div className="author-avatar" aria-hidden="true">
            {author_name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="author-info">
          <h3 className="author-name">{author_name}</h3>
          <p className="author-role">{ROLE_LABELS[author_role]}</p>
          {organization_name && (
            <p className="author-organization">{organization_name}</p>
          )}
        </div>
      </div>
    </article>
  );
};
