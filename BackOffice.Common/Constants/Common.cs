using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Common.Constants
{
    public static class CommonConstants
    {
        public static class ConfigurationType
        {
            public const string POS = "POS";
            public const string BO = "BO";
            public const string HO = "HO";
        }
        public static class DirectionTypes
        {
            public const string PosToBO = "PosToBO";
            public const string BOToPOS = "BOToPOS";

            public const string BOToHO = "BOToHO";
            public const string HOToBO = "HOToBO";
        }
    }
}
