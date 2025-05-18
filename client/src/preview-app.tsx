import React, { useEffect, useState } from 'react';
import './index.css';

const styles = {
  app: {
    fontFamily: 'Inter, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 0',
    borderBottom: '1px solid #e5e7eb'
  },
  mainContent: {
    padding: '40px 0'
  },
  card: {
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    padding: '20px',
    marginBottom: '20px'
  },
  button: {
    backgroundColor: '#4F46E5',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  link: {
    color: '#4F46E5',
    textDecoration: 'none',
    fontWeight: '500'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '20px'
  },
  jobCard: {
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '20px',
    transition: 'transform 0.2s',
    cursor: 'pointer'
  }
};

// Mock jobs data for development
const mockJobs = [
  {
    id: 1,
    title: "Kitchen Renovation",
    description: "Complete kitchen renovation including countertops, cabinets and appliances",
    status: "open",
    budget: 8500,
    categoryTags: ["plumbing", "electrical", "carpentry"],
    location: { city: "Toronto", state: "Ontario" }
  },
  {
    id: 2, 
    title: "Bathroom Remodel",
    description: "Full bathroom remodel with new fixtures, tiling and vanity",
    status: "open",
    budget: 5200,
    categoryTags: ["plumbing", "tiling"],
    location: { city: "Vancouver", state: "British Columbia" }
  },
  {
    id: 3,
    title: "Fence Installation",
    description: "Install 80 feet of wooden privacy fence",
    status: "open",
    budget: 3400,
    categoryTags: ["carpentry", "landscaping"],
    location: { city: "Calgary", state: "Alberta" }
  }
];

// Mock contractor profile data
const mockProfile = {
  id: 1,
  userId: 7,
  businessName: "EXPRESS BUILDING DEVELOPMENTS",
  trades: [],
  skills: ["Drywall", "Flooring", "Painting", "Carpentry"],
  bio: "Express Building Developments delivers expert drywall, steel framing, and taping services across Nova Scotia. Known for precision, speed, and reliability, we help residential and commercial projects get built right — and on time",
  serviceRadius: 25,
  walletBalance: 0,
  averageRating: null
};

function DevelopmentPreview() {
  const [apiStatus, setApiStatus] = useState('loading');
  const [jobs, setJobs] = useState(mockJobs);
  const [profile, setProfile] = useState(mockProfile);
  const [selectedJob, setSelectedJob] = useState(null);

  // Check if the API is available
  useEffect(() => {
    fetch('/api/health')
      .then(response => {
        if (response.ok) return response.json();
        throw new Error('API endpoint not available');
      })
      .then(data => {
        setApiStatus('connected');
        // Now try to get real data
        return fetch('/api/jobs-fix/all-jobs');
      })
      .then(response => {
        if (response.ok) return response.json();
        return mockJobs; // Use mock data if API fails
      })
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setJobs(data);
        }
      })
      .catch(error => {
        console.error('API Error:', error);
        setApiStatus('disconnected');
        // Use mock data when API is not available
        setJobs(mockJobs);
      });
      
    // Try to get profile data
    fetch('/api/contractor-profile-fix/7')
      .then(response => {
        if (response.ok) return response.json();
        return mockProfile;
      })
      .then(data => {
        if (data) setProfile(data);
      })
      .catch(error => {
        console.error('Profile API Error:', error);
      });
  }, []);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Real Service</h1>
          <p style={{ color: '#6B7280', margin: '4px 0 0 0' }}>Development Preview</p>
        </div>
        <div>
          <span style={{ 
            padding: '6px 10px', 
            borderRadius: '20px',
            backgroundColor: apiStatus === 'connected' ? '#ECFDF5' : '#FEF2F2',
            color: apiStatus === 'connected' ? '#059669' : '#EF4444',
            fontWeight: '500',
            fontSize: '14px',
            display: 'inline-block'
          }}>
            {apiStatus === 'connected' ? '✓ API Connected' : '× API Unavailable'}
          </span>
        </div>
      </header>

      <main style={styles.mainContent}>
        <section style={styles.card}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: 0 }}>Contractor Profile</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><strong>Business:</strong> {profile.businessName}</p>
            <p><strong>Bio:</strong> {profile.bio}</p>
            <p><strong>Skills:</strong> {profile.skills.join(', ')}</p>
            <p><strong>Service Radius:</strong> {profile.serviceRadius} miles</p>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Available Jobs</h2>
          <div style={styles.grid}>
            {jobs.map(job => (
              <div 
                key={job.id} 
                style={styles.jobCard}
                onClick={() => setSelectedJob(job)}
              >
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginTop: 0 }}>{job.title}</h3>
                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>
                  {job.description?.substring(0, 100)}...
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#059669' }}>${job.budget?.toFixed(2)}</span>
                  <span style={{ fontSize: '14px', color: '#6B7280' }}>
                    {job.location?.city}, {job.location?.state}
                  </span>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {job.categoryTags?.map((tag, index) => (
                    <span 
                      key={index}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#E0E7FF',
                        color: '#4F46E5',
                        fontSize: '12px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {selectedJob && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>{selectedJob.title}</h2>
                <button 
                  onClick={() => setSelectedJob(null)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '20px', 
                    cursor: 'pointer' 
                  }}
                >×</button>
              </div>
              <div>
                <p><strong>Description:</strong> {selectedJob.description}</p>
                <p><strong>Budget:</strong> ${selectedJob.budget?.toFixed(2)}</p>
                <p><strong>Location:</strong> {selectedJob.location?.city}, {selectedJob.location?.state}</p>
                <p><strong>Status:</strong> {selectedJob.status}</p>
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button style={styles.button}>Submit Bid</button>
                  <button 
                    style={{ ...styles.button, backgroundColor: 'transparent', color: '#4F46E5', border: '1px solid #4F46E5' }}
                    onClick={() => setSelectedJob(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: '20px 0', color: '#6B7280', borderTop: '1px solid #e5e7eb' }}>
        <p>Real Service Development Environment</p>
        <p>Production deployment: <a href="https://real-service-api-kux2.onrender.com" target="_blank" style={styles.link}>real-service-api-kux2.onrender.com</a></p>
      </footer>
    </div>
  );
}

export default DevelopmentPreview;