using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace BackOffice.Common.Functions
{
    public static class CommonFunctions
    {
        public static bool IsValidJson<T>(string str)
        {
            try
            {
                JsonConvert.DeserializeObject<T>(str);  // Deserialize to the provided type
                return true;
            }
            catch (Newtonsoft.Json.JsonException)
            {
                return false; // If exception occurs, it's not valid JSON
            }
        }
    }
}
