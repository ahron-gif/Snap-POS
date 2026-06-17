namespace BackOffice.Application.DTOs.Mian.License
{
    /// <summary>
    /// One row of the StoreData child table inside the encrypted EncData blob.
    /// FrmStartWz exposes these fields under "Please enter your store
    /// information" — they're the per-store address/phone/logo, keyed on
    /// StoreID (matches dbo.Store.StoreID in the tenant DB).
    /// </summary>
    public class StoreInfoDto
    {
        public Guid StoreID { get; set; }

        /// <summary>
        /// Friendly name of the store (e.g. "DYLAN STORES"). Sourced from
        /// the tenant's <c>dbo.Store.StoreName</c> column at GET time —
        /// NOT stored inside the encrypted EncData blob, so it round-trips
        /// for display only and is ignored on save.
        /// </summary>
        public string? StoreName { get; set; }

        public string? Address { get; set; }
        /// <summary>
        /// Legacy column literally named <c>City,State,Zip</c> — encoded in
        /// the XSD as <c>City_x002C_State_x002C_Zip</c>. Exposed here with a
        /// safe property name; the serializer maps it back.
        /// </summary>
        public string? CityStateZip { get; set; }
        public string? Country { get; set; }
        public string? Phone1 { get; set; }
        public string? Phone2 { get; set; }
        public string? Fax { get; set; }

        /// <summary>
        /// Store logo, base64 encoded. The legacy column is xs:base64Binary,
        /// so the wire format already is base64 — we just surface it as a
        /// string so the React file picker can swap it in/out without the
        /// API layer having to deal with byte[].
        /// </summary>
        public string? LogoBase64 { get; set; }
    }
}
