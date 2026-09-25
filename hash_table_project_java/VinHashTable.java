package hashTheVin;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

//Hash Table class for Vehicle info storage and retrieval

class VinHashTable {
    private static final int HASH_PRIME = 769; //For table size of around 750 entries
    private List<LinkedList<Vehicle>> tableBuckets;
    private int tableSize;
    private int nElements;

    public VinHashTable(int tbSize) {
	    tableSize = tbSize;
	    nElements = 0;
	    tableBuckets = new ArrayList<>(tableSize);
	    for (int i = 0; i < tableSize; i++) {
	        tableBuckets.add(new LinkedList<>());
	    }
    }

    public size_t size() {
	    return nElements;
    }

	private size_t getHashIndex(String vin) {
	    int hashCode = 0;
	    int c = 1;
	    int featureIdx = 1;
	     
	    for (int i = 0; i < vin.length(); i++) {
		    if (i == 1 || i == 3 || i == 8 || i == 9 || i == 10 || i == 11) {
		        featureIdx++;
		    }
		 
            int charNum;
            char ch = vin.charAt(i);
            if (Character.isDigit(ch)) {
                charNum = ch - '0';
             charNum *= featureIdx * 10; //10 digits
             } else {
                 charNum = ch - 'A';
                 charNum *= featureIdx * 26; //26 letters
             }
             
             hashCode += (charNum * c) % tableSize;
             c *= HASH_PRIME;
             c = c % tableSize;
         }
         return hashCode % tableSize; //shrink to size of table
    }

    public void insert(Vehicle vehicle) {
        size_t hashIndex = getHashIndex(vehicle.getVIN());
        System.out.println("Hash is " + hashIndex);
        LinkedList<Vehicle> vehicleList = tableBuckets.get(hashIndex);
         
        if (vehicleList.isEmpty()) {
            vehicleList.add(vehicle);
            System.out.println("Inserted new vehicle with VIN: " + vehicle.getVIN());
            nElements++;
        } else {
            for (Vehicle v : vehicleList) {
                if (v.getVIN().equals(vehicle.getVIN())) {
                   v.update(vehicle);
                   return;
                }
            }
            vehicleList.add(vehicle);
            nElements++;
            double loadFactor = (1.0 * nElements) / (tableSize);
            if (loadFactor > LOAD_FACTOR) {
                rehash();
            }
        }
         
        System.out.println("Number of vehicles in the table is: " + nElements);
    }

    public void remove(String vin) {
        int hashIndex = getHashIndex(vin);
        LinkedList<Vehicle> vehicleList = tableBuckets.get(hashIndex);
         
        if (!vehicleList.isEmpty()) {
            vehicleList.removeIf(vehicle -> vehicle.getVIN().equals(vin));
            if (vehicleList.size() < nElements) {
                System.out.println("Removed Vehicle with VIN: " + vin);
                nElements--;
            }
        }
    }

    public Vehicle get(String vin) {
        Vehicle emptyVehicle = new Vehicle(vin, "-", "-", "-", "-");
        int hashIndex = getHashIndex(vin);
         
        System.out.println("Hash for vin: " + vin + " is: " + hashIndex);
         
        LinkedList<Vehicle> vehicleList = tableBuckets.get(hashIndex);
         
        for (Vehicle vehicle : vehicleList) {
            if (vehicle.getVIN().equals(vin)) {
                return vehicle;
            }
        }
        return emptyVehicle;
    }

    public void rehash() {
        List<LinkedList<Vehicle>> tempTable = new ArrayList<>(tableSize);
         
        for (LinkedList<Vehicle> vehicleList : tableBuckets) {
            tempTable.add(vehicleList);
        }
         
        tableBuckets.clear();
         
        tableBuckets = new ArrayList<>(2 * tableSize);
        for (int i = 0; i < 2 * tableSize; i++) {
            tableBuckets.add(new LinkedList<>());
        }
         
        for (LinkedList<Vehicle> vehicleList : tempTable) {
            for (Vehicle vehicle : vehicleList) {
                this.insert(vehicle);
            }
        }
    }

    void visualizeDistribution() {
        System.out.println("Hash Table Distribution (Separate Chaining):");
	    for (size_t i = 0; i < m_sz; i++) {
	        List<Vehicle> vehicleList = m_tableBuckets[i];
	        if (vehicleList.isEmpty())
               continue; 
		    System.out.print("Bucket " + i + " - ");
            for (Vehicle vehicle : vehicleList) {
                System.out.print(vehicle.getVIN() + " -> ");   
            }
            System.out.println("|");
	        
	    }
    }
}
