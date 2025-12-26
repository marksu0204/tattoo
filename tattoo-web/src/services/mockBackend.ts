
import { Artwork, Appointment, ArtworkStatus, User } from '../types';

// Points to the PHP file in your public_html folder
// CRITICAL: Use absolute path to ensure it works on nested routes (e.g. /artwork/1)
const API_URL = '/api.php';

// Helper to handle API responses robustly
const handleResponse = async (response: Response) => {
    const text = await response.text();
    
    if (!response.ok) {
        console.error(`[API Error ${response.status}]`, text);
        throw new Error(`Server returned status ${response.status}`);
    }
    
    // Handle empty responses
    if (!text || text.trim() === '') return {};

    try {
        const json = JSON.parse(text);
        // PHP sometimes returns { "error": "message" } even with 200 OK
        if (json && json.error) {
            throw new Error(json.error);
        }
        return json;
    } catch (e: any) {
        // If it's our own error from above, rethrow it
        if (e.message && typeof e.message === 'string' && !e.message.startsWith('Unexpected token')) {
            throw e;
        }
        console.error("JSON Parse Error. Raw text received:", text);
        throw new Error("Invalid response format from server");
    }
};

class MockBackend {
  // --- Category APIs ---
  async getCategories(): Promise<string[]> {
    try {
        const data = await handleResponse(await fetch(`${API_URL}?action=getCategories`));
        return Array.isArray(data) ? data : ['All', 'Flower', 'Animal', 'Geometry', 'Line Work', 'Traditional'];
    } catch (e) {
        console.warn("Failed to fetch categories, using default.", e);
        return ['All', 'Flower', 'Animal', 'Geometry', 'Line Work', 'Traditional']; // Safe fallback
    }
  }

  async addCategory(name: string): Promise<string[]> {
    return await handleResponse(await fetch(`${API_URL}?action=addCategory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    }));
  }

  async deleteCategory(name: string): Promise<string[]> {
    return await handleResponse(await fetch(`${API_URL}?action=deleteCategory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    }));
  }

  // --- Aftercare APIs ---
  async getAftercareContent(): Promise<string> {
      try {
        const res = await handleResponse(await fetch(`${API_URL}?action=getAftercare`));
        return res.content || '';
      } catch (e) {
          console.error("Failed to fetch aftercare:", e);
          return '載入失敗，請稍後再試。';
      }
  }

  async saveAftercareContent(content: string): Promise<void> {
      await handleResponse(await fetch(`${API_URL}?action=saveAftercare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      }));
  }

  // --- Artwork APIs ---

  async getArtworks(): Promise<Artwork[]> {
    try {
        // Add timestamp to prevent caching
        const data = await handleResponse(await fetch(`${API_URL}?action=getArtworks&t=${Date.now()}`));
        if (!Array.isArray(data)) return [];
        
        // Ensure numeric values are numbers (PHP might return strings)
        // Also handle legacy imageUrl vs new images[]
        return data.map((art: any) => {
            // Logic to handle image formats:
            // 1. If 'images' exists and is array, use it.
            // 2. If 'imageUrl' contains JSON string (["img1"]), parse it.
            // 3. If 'imageUrl' is simple string, wrap in array.
            
            // For now, we reverted to Single Image mode based on user request.
            // So we expect 'imageUrl' to be a string.
            
            return {
                ...art,
                price: art.price ? Number(art.price) : undefined,
                specialPrice: art.specialPrice ? Number(art.specialPrice) : undefined,
                tags: Array.isArray(art.tags) ? art.tags : []
            };
        });
    } catch (e) {
        console.error("Failed to load artworks", e);
        return [];
    }
  }

  async saveArtwork(artwork: Artwork): Promise<Artwork> {
    await handleResponse(await fetch(`${API_URL}?action=saveArtwork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(artwork)
    }));
    return artwork;
  }

  async deleteArtwork(id: string): Promise<void> {
    await handleResponse(await fetch(`${API_URL}?action=deleteArtwork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    }));
  }

  async toggleStatus(id: string): Promise<Artwork | null> {
    try {
        const artworks = await this.getArtworks();
        const artwork = artworks.find(a => a.id === id);
        if (artwork) {
          artwork.status = artwork.status === ArtworkStatus.AVAILABLE ? ArtworkStatus.CLAIMED : ArtworkStatus.AVAILABLE;
          await this.saveArtwork(artwork);
          return artwork;
        }
    } catch (e) {
        console.error("Toggle Status Error", e);
    }
    return null;
  }

  async getArtworkStats(): Promise<Record<string, number>> {
      try {
        return await handleResponse(await fetch(`${API_URL}?action=getArtworkStats`));
      } catch (e) {
          return {};
      }
  }

  // 記錄作品瀏覽次數
  async recordView(artworkId: string): Promise<void> {
      try {
        await handleResponse(await fetch(`${API_URL}?action=recordView`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: artworkId })
        }));
      } catch (e) {
          console.warn("Failed to record view", e);
      }
  }

  // --- User & Favorite APIs ---
  
  // CRITICAL: This method must be robust. If DB fails, return the local user object.
  async syncUser(user: User): Promise<User> {
      try {
        const syncedUser = await handleResponse(await fetch(`${API_URL}?action=syncUser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        }));
        
        // Ensure valid object response
        if (!syncedUser || typeof syncedUser !== 'object') {
             throw new Error("Invalid user data returned");
        }

        // Check if PHP returned an empty array (common PHP/PDO fail mode)
        if (Array.isArray(syncedUser) && syncedUser.length === 0) {
             throw new Error("Backend returned empty array for user");
        }

        // Ensure favorites is an array
        if (!Array.isArray(syncedUser.favorites)) {
            syncedUser.favorites = [];
        }
        return syncedUser;
      } catch (e) {
          // If Backend fails (e.g. 500 error, DB error, Name encoding error), 
          // we MUST fall back to the local user object to keep the app working.
          console.warn("[Backend] User Sync Failed (Using local fallback):", e);
          
          return {
              ...user,
              favorites: user.favorites || [] 
          }; 
      }
  }

  async toggleFavorite(userId: string, artworkId: string): Promise<string[]> {
      return await handleResponse(await fetch(`${API_URL}?action=toggleFavorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, artworkId })
      }));
  }

  // --- Appointment APIs ---

  async getAppointments(): Promise<Appointment[]> {
    try {
        const data = await handleResponse(await fetch(`${API_URL}?action=getAppointments&t=${Date.now()}`));
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error("Failed to load appointments", e);
        return [];
    }
  }

  async getUserAppointments(userId: string): Promise<Appointment[]> {
      try {
        const all = await this.getAppointments();
        return all.filter(apt => apt.userId === userId);
      } catch (e) {
          console.error("Failed to get user appointments", e);
          // Return empty array instead of throwing to prevent UI crash
          return [];
      }
  }

  async getAppointment(id: string): Promise<Appointment | null> {
      try {
        const all = await this.getAppointments();
        return all.find(apt => apt.id === id) || null;
      } catch (e) {
          console.error("Failed to get appointment", e);
          return null;
      }
  }

  async saveAppointment(apt: Appointment): Promise<Appointment> {
    await handleResponse(await fetch(`${API_URL}?action=saveAppointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apt)
    }));
    return apt;
  }

  async deleteAppointment(id: string): Promise<void> {
    await handleResponse(await fetch(`${API_URL}?action=deleteAppointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    }));
  }

  async cancelAppointment(id: string): Promise<void> {
      const all = await this.getAppointments();
      const target = all.find(a => a.id === id);
      
      if (target) {
          await this.deleteAppointment(id);
      }
  }

  // --- Consent Form APIs ---
  
  async getConsent(appointmentId: string): Promise<Appointment | null> {
      try {
        const data = await handleResponse(await fetch(`${API_URL}?action=getConsent&id=${appointmentId}`));
        if (data.error) return null;
        // 確保數字欄位正確
        return {
            ...data,
            totalPrice: data.totalPrice ? Number(data.totalPrice) : undefined,
            depositPaid: data.depositPaid ? Number(data.depositPaid) : undefined
        };
      } catch (e) {
          console.error("Failed to get consent data", e);
          return null;
      }
  }

  async saveConsent(data: { id: string; signerName: string; signerPhone: string; signatureData: string }): Promise<boolean> {
      try {
        await handleResponse(await fetch(`${API_URL}?action=saveConsent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }));
        return true;
      } catch (e) {
          console.error("Failed to save consent", e);
          return false;
      }
  }

  // --- User Management APIs ---
  async getAllUsers(): Promise<any[]> {
      try {
          const data = await handleResponse(await fetch(`${API_URL}?action=getAllUsers&t=${Date.now()}`));
          return Array.isArray(data) ? data : [];
      } catch (e) {
          console.error("Failed to load users", e);
          return [];
      }
  }
}

export const db = new MockBackend();
