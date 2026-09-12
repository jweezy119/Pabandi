import axios from 'axios';

/**
 * CourtListener API Client for legal research and decision support
 * Provides access to court opinions, dockets, judges, and case law
 */
class CourtListenerClient {
  private baseUrl: string;
  private apiToken: string;

  constructor(baseUrl: string = 'https://api.courtlistener.com', apiToken: string = '')
  {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
  }

  /**
   * Fetch court opinions by cluster (case name)
   * @param cluster - Court cluster name (e.g., "United States District Courts")
   * @param query - Search query string
   * @returns Array of opinion objects
   */
  async getOpinions(cluster: string, query: string): Promise<Array<any>> {
    const url = `${this.baseUrl}/opinions`;
    const params = new URLSearchParams({
      cluster,
      query,
      limit: 50,
      offset: 0
    });
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Accept': 'application/json'
      }
    });
    
    return response.data;
  }

  /**
   * Fetch court dockets
   * @param cluster - Court cluster name
   * @param query - Docket search query
   * @returns Array of docket entries
   */
  async getDockets(cluster: string, query: string): Promise<Array<any>> {
    const url = `${this.baseUrl}/dockets`;
    const params = new URLSearchParams({
      cluster,
      query,
      limit: 50
    });
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Accept': 'application/json'
      }
    });
    
    return response.data;
  }

  /**
   * Fetch judicial information
   * @param court - Court name
   * @returns Judicial information
   */
  async getJudges(court: string): Promise<Array<any>> {
    const url = `${this.baseUrl}/judges`;
    const params = new URLSearchParams({
      court,
      limit: 50
    });
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Accept': 'application/json'
      }
    });
    
    return response.data;
  }

  /**
   * Search all opinions across clusters
   * @param query - Search query
   * @returns Array of matching opinions
   */
  async search(query: string): Promise<Array<any>> {
    const url = `${this.baseUrl}/search`;
    const params = new URLSearchParams({
      q: query,
      limit: 50
    });
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Accept': 'application/json'
      }
    });
    
    return response.data;
  }
}

export default CourtListenerClient;