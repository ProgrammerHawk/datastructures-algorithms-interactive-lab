// Design of a Hash Table for storing and retrieving Vehicle VIN numbers
// Author: Anirudh Iyengar
//
// Details:
//      1. Assuming Vehicle VIN is 17 characters long using digits and letters
//      2. Total number of possible combinations: Around 2^42
//      3. Number of Unique characteristics - 7
//          a. Vehicle manufacturing place - 1 char
//          b. Manufacturer - 2 char
//          c. Brand/Engine Size/Type - 5 char
//          d. Security Code - 1 char
//          e. Model Year - 1 char
//          f. Assembly Plant - 1 char
//          g. Serial Number - 6 char
// Hash Table Implementation for VIN numbers:
//  1. Vehicle class contains details like Manufacturer, Year and color
//  2. VehicleVIN class that stores the VIN and provides a unique integer code
//  for the VIN
//  3. HashTable class that provides storage of VIN -> Vehicle association 
//  using a custom hash function, separate chaining for collision resolution,
//  dynamic resizing and visualization of the distribution
//  4. Hash function - Properties
//      a. Collision minimization -
//          Larger table size,
//          use modulo with prime for uniform distribution
//          use the 7 VIN characteristics - each of them are weighted and added
//      b. Initial table size - 
//          Assuming there are 1.5 million cars in San Jose, with load factor of 0.7
//          we can have a table size of 2.15 million. (num cars / load factor)
//          For the code we will use 500 cars.
//      c. Dynamic resizing - 
//          Double the table size when load factor exceeds 0.7 and rehash
//          Shrink when load factor becomes less than 0.2
/////////////////////////////////////////////////////////////////////////////////////

package hashTheVin;


import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

final double LOAD_FACTOR = 0.7;

public class Utilities {
    public static size_t getInitialTableSize(size_t numElem) {
        return (size_t)(numElem * 1.0 / LOAD_FACTOR);   
    }
}

public class Main {
    public static void main(String[] args) {
    	//testing
        //Create a hash table with initial table capacity
	    size_t tableCapacity = Utilities.getInitialTableSize(500); // 500 vehicles
        VinHashTable vehicles = new VinHashTable(tableCapacity);
        //Create 5 vehicles and insert them into the table
        String vin1 = "4Y1SL65848Z411439";
        String vin2 = "2HNYD18994NH50321";
	    String vin3 = "3D7KS29C57G700703";
    	String vin4 = "1ZVBP8CF7B5158051";
    	String vin5 = "1FTZF0727YKA98103";
        
        Vehicle vehicle1 = new Vehicle(vin1, "VW", "Jetta", "Grey", "2203");
        Vehicle vehicle2 = new Vehicle(vin2, "Honda", "Acura RDX", "White", "2014");
        Vehicle vehicle3 = new Vehicle(vin3, "Mazda", "RX", "Black", "2007");
    	Vehicle vehicle4 = new Vehicle(vin4, "Infinity", "QX50", "Silver", "2010");
    	Vehicle vehicle5 = new Vehicle(vin5, "Toyota", "Prius", "Red", "2012");
        
	    //testing insertion
    	vinHashTable.insert(vehicle1);
    	vinHashTable.insert(vehicle2);
    	vinHashTable.insert(vehicle3);
    	vinHashTable.insert(vehicle4);
    	vinHashTable.insert(vehicle5);
        
        //testing 'get' function
        Vehicle firstVehicle = vehicles.get(vin1);
        
        //testing print
        System.out.print("Vehicle found for VIN: 4Y1SL65848Z411439 is: ");
        firstVehicle.printVehicle();
        System.out.println("Table has: " + vehicles.size() + " vehicles.");
        
	    // visualize distribution
	    vinHashTable.visualizeDistribution();

        //testing removal
        vehicles.remove(vin2);
        System.out.println("Table has: " + vehicles.size() + " vehicles.");
    }
}
