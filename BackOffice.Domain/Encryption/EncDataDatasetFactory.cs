using System.Data;
using System.Reflection;

namespace BackOffice.Domain.Encryption
{
    /// <summary>
    /// Loads the embedded <c>EncDataDS.xsd</c> schema into a fresh
    /// <see cref="DataSet"/>. The legacy WinForms BackOffice uses a typed
    /// dataset generated from this same XSD and writes the EncData XML via
    /// <c>DataSet.WriteXml</c>. By driving the web app off the identical
    /// schema we get byte-for-byte round-trip with the desktop app — same
    /// namespace, element order, type promotion (xs:boolean → lowercase
    /// true/false, xs:dateTime ISO 8601 with offset, xs:base64Binary, etc.).
    /// </summary>
    public static class EncDataDatasetFactory
    {
        /// <summary>XML namespace declared in EncDataDS.xsd. Pinned here so
        /// XML construction code can reference a single source of truth.</summary>
        public const string Namespace = "http://tempuri.org/EncDataDS.xsd";

        /// <summary>DataSet name (root XML element).</summary>
        public const string DatasetName = "EncDataDS";

        /// <summary>Name of the parent (single-row) table.</summary>
        public const string EncDataTableName = "EncData";

        /// <summary>Name of the per-store child table.</summary>
        public const string StoreDataTableName = "StoreData";

        // Resource name follows MSBuild default convention:
        //   "{RootNamespace}.{FolderPath}.{FileName}" with '/' replaced by '.'
        private const string XsdResourceName = "BackOffice.Domain.Encryption.EncDataDS.xsd";

        /// <summary>
        /// Returns a fresh, empty <see cref="DataSet"/> whose schema matches
        /// the legacy EncDataDS. Call <c>ds.ReadXml(...)</c> to populate from
        /// decrypted plaintext, or add rows directly to <c>ds.Tables["EncData"]</c>
        /// / <c>ds.Tables["StoreData"]</c> and call <c>ds.WriteXml(...,
        /// XmlWriteMode.IgnoreSchema)</c> to produce the plaintext to encrypt.
        /// </summary>
        public static DataSet CreateEmpty()
        {
            var ds = new DataSet
            {
                // Match the typed dataset's behaviour — locale-aware string
                // comparison, named EncDataDS so WriteXml produces
                // <EncDataDS xmlns="…"> as the root element.
                DataSetName = DatasetName,
                Namespace = Namespace,
                Locale = System.Globalization.CultureInfo.InvariantCulture
            };

            using var stream = Assembly.GetExecutingAssembly()
                .GetManifestResourceStream(XsdResourceName)
                ?? throw new InvalidOperationException(
                    $"Embedded resource '{XsdResourceName}' was not found. " +
                    "Check that EncDataDS.xsd is in BackOffice.Domain/Encryption/ " +
                    "and marked as <EmbeddedResource> in BackOffice.Domain.csproj.");

            ds.ReadXmlSchema(stream);
            return ds;
        }
    }
}
