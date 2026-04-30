const FIREBASE_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";
const FIREBASE_REFRESH_URL = "https://securetoken.googleapis.com/v1/token";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/sbs-diet-app/databases/(default)/documents";
const BUNDLE_ID_HEADER = { "X-Ios-Bundle-Identifier": "com.sbs.diet" };

interface NutritionEntry {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface WeightEntry {
  date: string;
  weight_kg: number;
}

export class MacroFactorClient {
  private idToken: string;
  private refreshToken: string;
  private userId: string;
  private expiresAt: number;
  private apiKey: string;

  private constructor(idToken: string, refreshToken: string, userId: string, expiresIn: number, apiKey: string) {
    this.idToken = idToken;
    this.refreshToken = refreshToken;
    this.userId = userId;
    this.expiresAt = Date.now() + expiresIn * 1000;
    this.apiKey = apiKey;
  }

  static async login(email: string, password: string, firebaseApiKey: string): Promise<MacroFactorClient> {
    const res = await fetch(`${FIREBASE_AUTH_URL}?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...BUNDLE_ID_HEADER },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data = await res.json() as { idToken: string; refreshToken: string; localId: string; expiresIn: string; error?: { message: string } };
    if (!res.ok) throw new Error(data.error?.message || "Firebase auth failed");

    return new MacroFactorClient(
      data.idToken,
      data.refreshToken,
      data.localId,
      parseInt(data.expiresIn, 10),
      firebaseApiKey,
    );
  }

  private async ensureToken(): Promise<void> {
    if (Date.now() < this.expiresAt - 60_000) return;

    const res = await fetch(`${FIREBASE_REFRESH_URL}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...BUNDLE_ID_HEADER },
      body: `grant_type=refresh_token&refresh_token=${this.refreshToken}`,
    });

    const data = await res.json() as { id_token: string; refresh_token: string; expires_in: string };
    if (!res.ok) throw new Error("Token refresh failed");

    this.idToken = data.id_token;
    this.refreshToken = data.refresh_token;
    this.expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000;
  }

  private async firestoreGet(path: string): Promise<Record<string, unknown>> {
    await this.ensureToken();
    const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
      headers: { Authorization: `Bearer ${this.idToken}` },
    });
    if (!res.ok) throw new Error(`Firestore GET ${path} failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  async getNutrition(startDate: string, endDate: string): Promise<NutritionEntry[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results: NutritionEntry[] = [];

    const yearSet = new Set<number>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      yearSet.add(d.getFullYear());
    }

    for (const year of yearSet) {
      type FieldValue = { stringValue?: string; doubleValue?: number; integerValue?: string };
      type FirestoreDoc = { fields?: Record<string, { mapValue?: { fields?: Record<string, FieldValue> } }> };
      const doc = await this.firestoreGet(`users/${this.userId}/nutrition/${year}`) as FirestoreDoc;
      if (!doc.fields) continue;

      for (const [mmdd, value] of Object.entries(doc.fields)) {
        const month = parseInt(mmdd.slice(0, 2), 10);
        const day = parseInt(mmdd.slice(2, 4), 10);
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (date < startDate || date > endDate) continue;

        const f = value.mapValue?.fields;
        if (!f) continue;

        results.push({
          date,
          calories: parseFloat(f.calories?.stringValue || f.calories?.doubleValue?.toString() || "0"),
          protein: parseFloat(f.protein?.stringValue || f.protein?.doubleValue?.toString() || "0"),
          carbs: parseFloat(f.carbs?.stringValue || f.carbs?.doubleValue?.toString() || "0"),
          fat: parseFloat(f.fat?.stringValue || f.fat?.doubleValue?.toString() || "0"),
          fiber: parseFloat(f.fiber?.stringValue || f.fiber?.doubleValue?.toString() || "0"),
        });
      }
    }

    return results;
  }

  async getWeightEntries(startDate: string, endDate: string): Promise<WeightEntry[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results: WeightEntry[] = [];

    const yearSet = new Set<number>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      yearSet.add(d.getFullYear());
    }

    for (const year of yearSet) {
      type WeightFieldValue = { doubleValue?: number; stringValue?: string };
      type WeightDoc = { fields?: Record<string, { mapValue?: { fields?: Record<string, WeightFieldValue> } }> };
      const doc = await this.firestoreGet(`users/${this.userId}/scale/${year}`) as WeightDoc;
      if (!doc.fields) continue;

      for (const [mmdd, value] of Object.entries(doc.fields)) {
        const month = parseInt(mmdd.slice(0, 2), 10);
        const day = parseInt(mmdd.slice(2, 4), 10);
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (date < startDate || date > endDate) continue;

        const f = value.mapValue?.fields;
        if (!f) continue;

        const weight = f.weight?.doubleValue ?? parseFloat(f.weight?.stringValue || "0");
        if (weight > 0) results.push({ date, weight_kg: weight });
      }
    }

    return results;
  }

  async getFoodLog(date: string): Promise<Record<string, unknown>> {
    return this.firestoreGet(`users/${this.userId}/food/${date}`);
  }

  async validate(): Promise<boolean> {
    try {
      await this.firestoreGet(`users/${this.userId}`);
      return true;
    } catch {
      return false;
    }
  }
}
