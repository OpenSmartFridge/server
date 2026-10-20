import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import type { Product } from "./types";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { MdVisibility } from "react-icons/md";

interface ProductsTabProps {
  userId: number;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function toApiDate(dateInput: string): string {
  return `${dateInput}T00:00:00Z`;
}

export function ProductsTab({ userId }: ProductsTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [expire, setExpire] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeExpire, setBarcodeExpire] = useState("");

  const [showScanner, setShowScanner] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editExpire, setEditExpire] = useState("");

  function loadProducts() {
    api
      .getProducts()
      .then((data) => {
        setProducts(data ?? []);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Fehler beim Laden"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.createProduct(userId, name, toApiDate(expire));
      setName("");
      setExpire("");
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Hinzufügen");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddByBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.createProductByBarcode(barcode, toApiDate(barcodeExpire));
      setBarcode("");
      setBarcodeExpire("");
      loadProducts();
    } catch {
      setError("Produkt zum Barcode konnte nicht gefunden werden");
    } finally {
      setSubmitting(false);
      setBarcode("");
    }
  }

  async function handleDelete(id: number) {
    setError("");
    try {
      await api.deleteProduct(id);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.Id);
    setEditName(product.Name);
    setEditExpire(toDateInputValue(product.Expire));
  }

  async function handleSaveEdit(product: Product) {
    setError("");
    try {
      await api.updateProduct(
        product.Id,
        editName,
        toApiDate(editExpire),
        product.Position,
      );
      setEditingId(null);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes.length > 0) {
      const value = detectedCodes[0].rawValue;
      setBarcode(value);
      closeScannerPopUp();
    }
  };

  const showScannerPopUp = () => {
    setShowScanner(true);
    dialogRef.current?.showModal();
  };

  const closeScannerPopUp = () => {
    setShowScanner(false);
    dialogRef.current?.close();
  };

  return (
    <div>
      <dialog ref={dialogRef} onClose={closeScannerPopUp}>
        {showScanner && (
          <Scanner
            onScan={handleScan}
            onError={(err) => console.log("Scanner Error: ", err)}
          />
        )}
        <button type="button" onClick={closeScannerPopUp}>
          Abbrechen
        </button>
      </dialog>

      <form onSubmit={handleAdd} className="inline-form">
        <input
          type="text"
          placeholder="Produktname"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          type="date"
          value={expire}
          onChange={(event) => setExpire(event.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          Hinzufügen
        </button>
      </form>

      <form onSubmit={handleAddByBarcode} className="inline-form">
        <input
          type="text"
          placeholder="Barcode"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          required
        />
        <input
          type="date"
          value={barcodeExpire}
          onChange={(event) => setBarcodeExpire(event.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          Per Barcode hinzufügen
        </button>
        <button onClick={showScannerPopUp}>
          <MdVisibility style={{ verticalAlign: "middle" }} />
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Lädt...</p>
      ) : products.length === 0 ? (
        <p>Noch keine Produkte im Kühlschrank.</p>
      ) : (
        <details>
          <summary>Produkte</summary>
          <ul className="item-list">
            {products.map((product) => (
              <li key={product.Id} className="item-row">
                {editingId === product.Id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                    <input
                      type="date"
                      value={editExpire}
                      onChange={(event) => setEditExpire(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(product)}
                    >
                      Speichern
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setEditingId(null)}
                    >
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <>
                    <span className="item-name">{product.Name}</span>
                    <span className="item-meta">
                      {toDateInputValue(product.Expire)}
                    </span>
                    <button type="button" onClick={() => startEdit(product)}>
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.Id)}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default ProductsTab;
