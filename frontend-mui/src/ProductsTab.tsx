import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import type { Product } from "./types";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  Box,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Typography,
  Alert,
  CircularProgress,
  Stack,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editExpire, setEditExpire] = useState("");

  const [addedProduct, setAddedProduct] = useState<{
    name: string;
    expire: string;
  } | null>(null);

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
      setAddedProduct({ name, expire });
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
      const product = await api.createProductByBarcode(
        barcode,
        toApiDate(barcodeExpire),
      );

      setAddedProduct({
        name: product.Name,
        expire: barcodeExpire,
      });

      setBarcode("");
      setBarcodeExpire("");
      loadProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Produkt zum Barcode konnte nicht gefunden werden",
      );
    } finally {
      setSubmitting(false);
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
  };

  const closeScannerPopUp = () => {
    setShowScanner(false);
  };

  const closeAddedProductDialog = () => {
    setAddedProduct(null);
  };

  return (
    <Box>
      <Dialog
        open={showScanner}
        onClose={closeScannerPopUp}
        maxWidth="sm"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          {showScanner && (
            <Box sx={{ width: "100%", height: 400 }}>
              <Scanner
                onScan={handleScan}
                onError={(err: unknown) => console.log("Scanner Error: ", err)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={closeScannerPopUp}>
            Abbrechen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!addedProduct}
        onClose={closeAddedProductDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CheckCircleIcon color="success" />
          Produkt erfasst
        </DialogTitle>
        <DialogContent>
          {addedProduct && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {addedProduct.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Haltbar bis {addedProduct.expire}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={closeAddedProductDialog}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Stack spacing={1.5} sx={{ mb: 3 }}>
        <Box
          component="form"
          onSubmit={handleAdd}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "minmax(0, 1fr) 160px auto",
            },
            gap: 1,
            alignItems: "center",
            width: "100%",
          }}
        >
          <TextField
            label="Produktname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            size="small"
            fullWidth
          />

          <TextField
            type="date"
            value={expire}
            onChange={(event) => setExpire(event.target.value)}
            required
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />

          <Button
            variant="contained"
            type="submit"
            disabled={submitting}
            sx={{
              height: 40,
              px: 2,
              whiteSpace: "nowrap",
              width: { xs: "100%", sm: "auto" },
            }}
          >
            Hinzufügen
          </Button>
        </Box>

        <Box
          component="form"
          onSubmit={handleAddByBarcode}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr) auto",
              sm: "minmax(0, 1fr) 160px auto auto",
            },
            gap: 1,
            alignItems: "center",
            width: "100%",
          }}
        >
          <TextField
            label="Barcode"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            required
            size="small"
            fullWidth
            sx={{
              gridColumn: { xs: "1 / -1", sm: "auto" },
            }}
          />

          <TextField
            type="date"
            value={barcodeExpire}
            onChange={(event) => setBarcodeExpire(event.target.value)}
            required
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />

          <Button
            variant="contained"
            type="submit"
            disabled={submitting}
            sx={{
              height: 40,
              px: 2,
              whiteSpace: "nowrap",
              width: { xs: "100%", sm: "auto" },
            }}
          >
            Per Barcode hinzufügen
          </Button>

          <IconButton
            color="primary"
            onClick={showScannerPopUp}
            aria-label="Scanner öffnen"
            sx={{
              width: 40,
              height: 40,
              gridColumn: { xs: "2", sm: "auto" },
              gridRow: { xs: "1", sm: "auto" },
            }}
          >
            <VisibilityIcon />
          </IconButton>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography>Lädt...</Typography>
        </Box>
      ) : products.length === 0 ? (
        <Typography>Noch keine Produkte im Kühlschrank.</Typography>
      ) : (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Produkte</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List disablePadding>
              {products.map((product) => (
                <ListItem
                  key={product.Id}
                  divider
                  secondaryAction={
                    editingId === product.Id ? (
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          color="primary"
                          onClick={() => handleSaveEdit(product)}
                          aria-label="Speichern"
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          onClick={() => setEditingId(null)}
                          aria-label="Abbrechen"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          onClick={() => startEdit(product)}
                          aria-label="Bearbeiten"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(product.Id)}
                          aria-label="Löschen"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )
                  }
                >
                  {editingId === product.Id ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ pr: 10, width: "100%" }}
                    >
                      <TextField
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        size="small"
                      />
                      <TextField
                        type="date"
                        value={editExpire}
                        onChange={(event) => setEditExpire(event.target.value)}
                        size="small"
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Stack>
                  ) : (
                    <ListItemText
                      primary={product.Name}
                      secondary={toDateInputValue(product.Expire)}
                    />
                  )}
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

export default ProductsTab;
