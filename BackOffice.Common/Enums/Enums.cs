using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Common.Enums
{
    public class Enums
    {
        public enum SyncTypeEnum
        {
            Initial,
            Delta,
            Forced
        }

        public enum SyncDirectionEnum
        {
            POS_TO_BO,
            POS_TO_HO,
            BO_TO_HO,
            BO_TO_POS,
            HO_TO_POS,
            HO_TO_BO
        }
    }
}
